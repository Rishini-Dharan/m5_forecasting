import logging
import statistics
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db.db import db
from models import npn_loader
from utils.auth_utils import get_current_user
from utils.authz import assert_store_access, is_admin, scope_filter

router = APIRouter()
logger = logging.getLogger(__name__)


class HistoricalDataRequest(BaseModel):
    item_id: str
    store_id: str
    days: int = Field(28, ge=1, le=365)


class DataPoint(BaseModel):
    day: int
    sales: int


class HistoricalResponse(BaseModel):
    item_id: str
    store_id: str
    data: List[DataPoint]


@router.post("/historical", response_model=HistoricalResponse)
def get_historical_data(req: HistoricalDataRequest, current_user: dict = Depends(get_current_user)):
    """Real historical sales for an item at a store."""
    assert_store_access(current_user, req.store_id)

    results = db.execute_query(
        """
        SELECT day_index, sales
        FROM historical_sales
        WHERE item_id = %s AND store_id = %s
        ORDER BY day_index DESC
        LIMIT %s
        """,
        (req.item_id, req.store_id, req.days),
        fetch=True,
    )

    data = [{"day": row["day_index"], "sales": row["sales"]} for row in reversed(results or [])]
    return HistoricalResponse(item_id=req.item_id, store_id=req.store_id, data=data)


@router.get("/price")
def get_price(
    item_id: str = Query(...),
    store_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    """The real recorded sell_price for a series, so the UI never has to invent one."""
    assert_store_access(current_user, store_id)
    try:
        return {"item_id": item_id, "store_id": store_id,
                "sell_price": npn_loader.latest_price(item_id, store_id)}
    except npn_loader.ModelUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception:
        logger.exception("Price lookup failed for %s at %s", item_id, store_id)
        raise HTTPException(status_code=500, detail="Could not read price")


@router.get("/stores")
def get_stores(current_user: dict = Depends(get_current_user)):
    """Stores the caller is allowed to see."""
    try:
        if is_admin(current_user):
            results = db.execute_query(
                "SELECT DISTINCT store_id FROM historical_sales ORDER BY store_id", fetch=True
            )
            stores = [row["store_id"] for row in results] if results else []
            if not stores:
                stores = npn_loader.known_stores()
            return {"stores": stores}

        # A store owner sees exactly their own store, and only if one is assigned.
        user_store = current_user.get("store_id")
        if not user_store:
            raise HTTPException(
                status_code=403, detail="Access denied: no store is assigned to this account"
            )
        return {"stores": [user_store]}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error fetching stores")
        raise HTTPException(status_code=500, detail="Could not fetch stores")


@router.get("/items")
def get_items(current_user: dict = Depends(get_current_user)):
    """Items visible to the caller, scoped to their store when they are a store owner."""
    try:
        where, params = scope_filter(current_user)
        results = db.execute_query(
            f"SELECT DISTINCT item_id FROM historical_sales {where} ORDER BY item_id",
            tuple(params) if params else None,
            fetch=True,
        )
        items = [row["item_id"] for row in results] if results else []
        if not items:
            items = npn_loader.known_items()
        return {"items": items}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error fetching items")
        raise HTTPException(status_code=500, detail="Could not fetch items")


@router.get("/store/{store_id}")
def get_store_details(store_id: str, current_user: dict = Depends(get_current_user)):
    """Items and summary metrics for one store."""
    assert_store_access(current_user, store_id)
    try:
        item_rows = db.execute_query(
            "SELECT DISTINCT item_id FROM historical_sales WHERE store_id = %s ORDER BY item_id",
            (store_id,),
            fetch=True,
        )
        items = [row["item_id"] for row in item_rows] if item_rows else []

        summary = db.execute_query(
            """
            SELECT COUNT(*) AS total_records,
                   SUM(sales)  AS total_sales,
                   AVG(sales)  AS avg_sales,
                   MAX(day_index) AS max_day,
                   MIN(day_index) AS min_day
            FROM historical_sales
            WHERE store_id = %s
            """,
            (store_id,),
            fetch_one=True,
        )

        return {
            "store_id": store_id,
            "items": items,
            "total_records": summary["total_records"] if summary else 0,
            "total_units": float(summary["total_sales"] or 0) if summary else 0.0,
            "avg_daily_units": float(summary["avg_sales"] or 0) if summary else 0.0,
            "day_range": {
                "min": (summary["min_day"] if summary else 0) or 0,
                "max": (summary["max_day"] if summary else 0) or 0,
            },
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Error fetching store details for %s", store_id)
        raise HTTPException(status_code=500, detail="Could not fetch store details")


@router.get("/insights")
def get_global_insights(current_user: dict = Depends(get_current_user)):
    """Insight metrics computed from historical_sales.

    Returns data_available=false rather than inventing numbers when there is nothing to report.
    """
    where, params = scope_filter(current_user)

    traj_results = db.execute_query(
        f"""
        SELECT day_index, SUM(sales) AS daily_total
        FROM historical_sales
        {where}
        GROUP BY day_index
        ORDER BY day_index ASC
        """,
        tuple(params) if params else None,
        fetch=True,
    )

    if not traj_results:
        return _empty_insights()

    trajectory_data = []
    daily_totals = []
    for idx, row in enumerate(traj_results):
        total = float(row["daily_total"])
        trajectory_data.append({"day": idx, "value": total})
        daily_totals.append(total)

    half_point = len(daily_totals) // 2
    first_half_sum = sum(daily_totals[:half_point])
    second_half_sum = sum(daily_totals[half_point:])
    total_units = sum(daily_totals)

    growth_pct = ((second_half_sum - first_half_sum) / first_half_sum * 100) if first_half_sum else 0.0
    growth_str = f"+{growth_pct:.1f}%" if growth_pct >= 0 else f"{growth_pct:.1f}%"

    if total_units >= 1_000_000:
        units_value = f"{total_units / 1_000_000:.1f}M units"
    elif total_units >= 1_000:
        units_value = f"{total_units / 1_000:.1f}K units"
    else:
        units_value = f"{total_units:.0f} units"

    mean_sales = statistics.mean(daily_totals)
    std_sales = statistics.stdev(daily_totals) if len(daily_totals) > 1 else 0.0
    stability = max(0.0, min(100.0, 100 - (std_sales / mean_sales * 100))) if mean_sales else 0.0

    anomaly_count = sum(
        1 for value in daily_totals if abs(value - mean_sales) > 1.5 * std_sales
    ) if std_sales else 0

    key_drivers, top_driver = _key_drivers(where, params)

    return {
        "data_available": True,
        # Units, not currency: historical_sales stores counts and carries no price.
        "total_units": {"value": units_value, "growth": growth_str,
                        "trend": "up" if growth_pct >= 0 else "down"},
        "demand_stability": {"value": f"{stability:.1f}%",
                             "status": "100% minus the coefficient of variation"},
        "anomalies": {"count": anomaly_count,
                      "status": "Review Required" if anomaly_count else "Normal Stability"},
        "trajectory_data": trajectory_data,
        "key_drivers": key_drivers,
        "top_driver": top_driver,
    }


def _key_drivers(where: str, params: list):
    """Top three items by volume, with their first-half vs second-half change."""
    midpoint_row = db.execute_query(
        f"SELECT MIN(day_index) AS lo, MAX(day_index) AS hi FROM historical_sales {where}",
        tuple(params) if params else None,
        fetch_one=True,
    )
    if not midpoint_row or midpoint_row["lo"] is None:
        return [], None
    midpoint = midpoint_row["lo"] + (midpoint_row["hi"] - midpoint_row["lo"]) / 2

    # One parameterised query -- the midpoint is passed as a value, not interpolated.
    driver_params = [midpoint, midpoint] + list(params)
    drivers = db.execute_query(
        f"""
        SELECT item_id,
               SUM(CASE WHEN day_index <  %s THEN sales ELSE 0 END) AS first_half,
               SUM(CASE WHEN day_index >= %s THEN sales ELSE 0 END) AS second_half,
               SUM(sales) AS total
        FROM historical_sales
        {where}
        GROUP BY item_id
        ORDER BY total DESC
        LIMIT 3
        """,
        tuple(driver_params),
        fetch=True,
    )

    key_drivers = []
    top_driver = None
    for row in drivers or []:
        if top_driver is None:
            top_driver = row["item_id"]
        first_half = float(row["first_half"] or 0)
        second_half = float(row["second_half"] or 0)
        change = ((second_half - first_half) / first_half * 100) if first_half else 0.0
        key_drivers.append({
            "name": row["item_id"].replace("_", " ").title(),
            "change": f"+{change:.1f}%" if change >= 0 else f"{change:.1f}%",
            "trend": "up" if change >= 0 else "down",
        })
    return key_drivers, top_driver


def _empty_insights():
    """No data is no data. The UI shows an empty state instead of invented metrics."""
    return {
        "data_available": False,
        "message": "No sales data found. Run scripts/seed_data.py to load the M5 dataset.",
        "total_units": {"value": "--", "growth": "--", "trend": "flat"},
        "demand_stability": {"value": "--", "status": "No data"},
        "anomalies": {"count": 0, "status": "No data"},
        "trajectory_data": [],
        "key_drivers": [],
        "top_driver": None,
    }
