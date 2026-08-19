import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from db.db import db
from models import npn_loader
from utils.auth_utils import get_current_user
from utils.authz import assert_store_access

router = APIRouter()
logger = logging.getLogger(__name__)


class PredictionRequest(BaseModel):
    item_id: str = Field(..., description="Item ID (e.g. FOODS_1_001)")
    store_id: str = Field(..., description="Store ID (e.g. CA_1)")
    price: Optional[float] = Field(
        None, gt=0, description="Scenario price override. Omit to use the real recorded price."
    )
    is_snap_day: Optional[int] = Field(
        None, ge=0, le=1, description="Scenario SNAP override. Omit to use the real calendar."
    )
    forecast_days: int = Field(
        npn_loader.MAX_HORIZON, ge=1, le=npn_loader.MAX_HORIZON,
        description=f"Days to forecast (1-{npn_loader.MAX_HORIZON})",
    )


class PredictionResponse(BaseModel):
    status: str
    item_id: str
    store_id: str
    predictions: List[float]
    baseline: List[float]
    dates: List[str]
    forecast_days: int
    forecast_origin: str
    scenario_applied: bool
    approximated_features: List[str]


class ModelInfoResponse(BaseModel):
    # `model_loaded` collides with Pydantic's reserved "model_" namespace and warns on import.
    model_config = {"protected_namespaces": ()}

    status: str
    model_loaded: bool
    repo: str
    max_horizon: int
    forecast_origin: str


@router.get("/model/info", response_model=ModelInfoResponse)
def model_info():
    """Report model status. Never triggers a download, so it stays usable when the model is not."""
    return ModelInfoResponse(
        status="success",
        model_loaded=npn_loader.is_ready(),
        repo=npn_loader.settings.NPN_REPO,
        max_horizon=npn_loader.MAX_HORIZON,
        forecast_origin=f"d_{npn_loader.FORECAST_ORIGIN_DNUM}",
    )


@router.get("/model/feature-importance")
def model_feature_importance(
    store_id: str = Query(..., description="Store whose models to inspect"),
    top_n: int = Query(8, ge=1, le=34),
    current_user: dict = Depends(get_current_user),
):
    """Real gain-based feature importance from the trained LightGBM boosters."""
    assert_store_access(current_user, store_id)
    try:
        return {
            "status": "success",
            "store_id": store_id,
            "importance_type": "gain",
            "features": npn_loader.feature_importance(store_id, top_n),
        }
    except npn_loader.ModelUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.exception("Feature importance failed for store %s", store_id)
        raise HTTPException(status_code=500, detail="Could not read feature importance")


@router.post("/predict", response_model=PredictionResponse)
def predict_sales(req: PredictionRequest, current_user: dict = Depends(get_current_user)):
    """Forecast up to 28 days of unit sales for one item at one store."""
    assert_store_access(current_user, req.store_id)

    try:
        result = npn_loader.predict_sales(
            item_id=req.item_id,
            store_id=req.store_id,
            days=req.forecast_days,
            price=req.price,
            is_snap_day=req.is_snap_day,
        )
    except npn_loader.ModelUnavailable as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Prediction failed for %s at %s", req.item_id, req.store_id)
        raise HTTPException(status_code=500, detail="Prediction failed")

    _log_prediction(req, current_user, result)

    return PredictionResponse(
        status="success",
        item_id=req.item_id,
        store_id=req.store_id,
        forecast_days=req.forecast_days,
        **result,
    )


def _log_prediction(req: PredictionRequest, current_user: dict, result: dict) -> None:
    """Record the prediction. Never let logging break a successful forecast."""
    try:
        user_row = db.execute_query(
            "SELECT id FROM users WHERE email = %s;", (current_user.get("sub"),), fetch_one=True
        )
        features = {
            "price": req.price,
            "is_snap_day": req.is_snap_day,
            "forecast_days": req.forecast_days,
            "scenario_applied": result["scenario_applied"],
        }
        db.execute_query(
            """
            INSERT INTO predictions (user_id, item_id, store_id, features_json, predicted_value)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user_row["id"] if user_row else None,
                req.item_id,
                req.store_id,
                json.dumps(features),
                result["predictions"][0] if result["predictions"] else 0,
            ),
        )
    except Exception:
        logger.warning("Could not log prediction for %s/%s", req.item_id, req.store_id,
                       exc_info=True)
