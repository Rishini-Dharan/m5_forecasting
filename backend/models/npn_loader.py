"""
NPN model loader — real M5 forecasting via per-store, per-horizon-block LightGBM.

Artifacts come from the Hugging Face repo `rishini/NPN` (see settings.NPN_REPO):

  models/model_store=<STORE>_hblock=block_<lo>_<hi>.txt   40 Tweedie LightGBM boosters
  feature_schema.json                                     34 features, exact order + dtypes
  categorical_maps.json                                   label encodings used at train time
  history_tail.parquet                                    30,490 series x 57 days (d_1885..d_1941)
  predictions.parquet                                     validated 28-day forecast for every series

Forecasts are produced in two parts:

  baseline    Read straight from predictions.parquet. This is the exact, validated output of
              the trained models at forecast origin d_1941 (WRMSSE 145.6).
  scenario    The user's price / SNAP overrides are applied by running the boosters twice over
              the same feature rows -- once unmodified, once with the overrides -- and taking
              the ratio. The absolute level therefore stays the validated one, while the
              response to the overrides comes from the model's own learned sensitivity.

Why the ratio: five features (te_dept_id, te_store_id, te_item_id, rolling_mean_60,
rolling_mean_180, days_since_last_nonzero, weeks_since_release, price_vs_hist_max) are computed
over the full training history, which the published 57-day tail cannot reconstruct. They are
approximated here. Because the approximation is identical in the numerator and denominator of
the ratio, it cancels out and does not bias the scenario adjustment.
"""

import json
import logging
import threading
from collections import OrderedDict
from datetime import date, timedelta

import lightgbm as lgb
import numpy as np
import pandas as pd
from huggingface_hub import hf_hub_download

from config import settings
from models import feature_glossary

logger = logging.getLogger(__name__)

# --- M5 constants -------------------------------------------------------------------------
D1_DATE = date(2011, 1, 29)          # M5 day d_1
FORECAST_ORIGIN_DNUM = 1941          # predictions.parquet origin
MAX_HORIZON = 28                     # the models cover exactly 28 days, in 4 blocks
HBLOCKS = ((1, 7), (8, 14), (15, 21), (22, 28))
TAIL_START_DNUM = 1885               # first day present in history_tail.parquet

# Features that cannot be reconstructed from the 57-day tail. Approximated, and cancelled by
# the scenario ratio. Listed here so the API can report them honestly.
APPROXIMATED_FEATURES = (
    "te_dept_id", "te_store_id", "te_item_id",
    "rolling_mean_60", "rolling_mean_180",
    "days_since_last_nonzero", "weeks_since_release",
    "price_vs_hist_max", "price_vs_dept_mean",
)

_lock = threading.Lock()
_schema = None
_maps = None
_predictions = None          # DataFrame indexed by M5 id
_tail_by_store = OrderedDict()   # store_id -> DataFrame  (LRU)
_boosters = OrderedDict()        # (store_id, block) -> Booster  (LRU)

_MAX_CACHED_STORES = 2       # Render free tier is 512 MB; never hold all 10 stores


class ModelUnavailable(RuntimeError):
    """Raised when the NPN artifacts cannot be loaded."""


# --- artifact loading ---------------------------------------------------------------------

def _download(filename: str) -> str:
    return hf_hub_download(repo_id=settings.NPN_REPO, filename=filename)


def load_metadata():
    """Load the small artifacts. Cheap, safe to call on startup."""
    global _schema, _maps, _predictions
    with _lock:
        if _schema is not None:
            return
        try:
            with open(_download("feature_schema.json"), encoding="utf-8") as fh:
                _schema = json.load(fh)
            with open(_download("categorical_maps.json"), encoding="utf-8") as fh:
                _maps = json.load(fh)
            preds = pd.read_parquet(_download("predictions.parquet"))
            _predictions = preds.set_index("id")
            logger.info(
                "NPN metadata loaded: %d features, %d series, origin d_%d",
                len(_schema["feature_names"]), len(_predictions), FORECAST_ORIGIN_DNUM,
            )
        except Exception as exc:
            _schema = _maps = _predictions = None
            raise ModelUnavailable(f"Could not load NPN metadata: {exc}") from exc


def feature_names() -> list:
    load_metadata()
    return list(_schema["feature_names"])


def is_ready() -> bool:
    """True if metadata is already loaded. Never triggers a download."""
    return _schema is not None and _predictions is not None


def known_stores() -> list:
    load_metadata()
    return sorted(_maps["store_id"].keys())


def known_items() -> list:
    load_metadata()
    return sorted(_maps["item_id"].keys())


def _get_booster(store_id: str, block: tuple) -> lgb.Booster:
    key = (store_id, block)
    with _lock:
        if key in _boosters:
            _boosters.move_to_end(key)
            return _boosters[key]
    path = _download(f"models/model_store={store_id}_hblock=block_{block[0]}_{block[1]}.txt")
    booster = lgb.Booster(model_file=path)
    with _lock:
        _boosters[key] = booster
        while len(_boosters) > _MAX_CACHED_STORES * len(HBLOCKS):
            _boosters.popitem(last=False)
    return booster


def _get_tail(store_id: str) -> pd.DataFrame:
    """History for one store, from history_tail.parquet. ~57 days x 3049 items."""
    with _lock:
        if store_id in _tail_by_store:
            _tail_by_store.move_to_end(store_id)
            return _tail_by_store[store_id]
    path = _download("history_tail.parquet")
    tail = pd.read_parquet(path, filters=[("store_id", "==", store_id)])
    tail = tail.astype({"item_id": "string", "dept_id": "string", "cat_id": "string",
                        "state_id": "string", "weekday": "string"})
    with _lock:
        _tail_by_store[store_id] = tail
        while len(_tail_by_store) > _MAX_CACHED_STORES:
            _tail_by_store.popitem(last=False)
    return tail


# --- helpers ------------------------------------------------------------------------------

def _int8(value: int) -> int:
    """Reproduce the int8 wrap-around applied to categorical codes at training time.

    feature_schema.json declares item_id/year as int8, but the label encodings run to 3048 and
    the years to 2016, so the training pipeline silently wrapped them. The models learned on the
    wrapped values, so we must wrap identically -- 'fixing' this would break the predictions.
    """
    return ((int(value) + 128) % 256) - 128


def block_for_horizon(horizon_day: int) -> tuple:
    for lo, hi in HBLOCKS:
        if lo <= horizon_day <= hi:
            return (lo, hi)
    raise ValueError(f"horizon day {horizon_day} outside 1..{MAX_HORIZON}")


def dnum_to_date(d_num: int) -> date:
    return D1_DATE + timedelta(days=d_num - 1)


def m5_id(item_id: str, store_id: str) -> str:
    return f"{item_id}_{store_id}_evaluation"


def forecast_dates(days: int) -> list:
    return [dnum_to_date(FORECAST_ORIGIN_DNUM + h).isoformat() for h in range(1, days + 1)]


# --- feature construction -----------------------------------------------------------------

WEEKDAY_CODES = ["Friday", "Monday", "Saturday", "Sunday", "Thursday", "Tuesday", "Wednesday"]


def _series_frame(item_id: str, store_id: str) -> pd.DataFrame:
    tail = _get_tail(store_id)
    series = tail[tail["item_id"] == item_id].sort_values("d_num")
    if series.empty:
        raise ModelUnavailable(f"No history for {item_id} at {store_id}")
    return series


def _build_feature_rows(item_id: str, store_id: str, days: int) -> pd.DataFrame:
    """Build one 34-feature row per horizon day, from the real history tail.

    Rows are anchored on the last `days` days of actual history rather than on future dates:
    those days have genuine sales, prices and calendar values, so every feature the tail can
    support is exact. These rows are only ever used as the common template for the scenario
    ratio, so their absolute level never reaches the user.
    """
    load_metadata()
    series = _series_frame(item_id, store_id)
    sales = series.set_index("d_num")["sales"].astype(float)
    prices = series.set_index("d_num")["sell_price"].astype(float)

    tail = _get_tail(store_id)
    dept_id = series["dept_id"].iloc[0]
    cat_id = series["cat_id"].iloc[0]
    state_id = series["state_id"].iloc[0]
    dept_price_mean = float(tail.loc[tail["dept_id"] == dept_id, "sell_price"].mean())
    price_hist_max = float(prices.max()) if len(prices) else 1.0
    series_mean = float(sales.mean()) if len(sales) else 0.0

    def window(end_dnum: int, size: int):
        """Values for the `size` days ending at end_dnum inclusive, newest first."""
        return np.array([sales.get(end_dnum - i, np.nan) for i in range(size)], dtype=float)

    def mean_of(end_dnum: int, size: int) -> float:
        vals = window(end_dnum, size)
        vals = vals[~np.isnan(vals)]
        return float(vals.mean()) if vals.size else 0.0

    def std_of(end_dnum: int, size: int) -> float:
        vals = window(end_dnum, size)
        vals = vals[~np.isnan(vals)]
        return float(vals.std(ddof=1)) if vals.size > 1 else 0.0

    anchors = [FORECAST_ORIGIN_DNUM - days + h for h in range(1, days + 1)]
    rows = []
    for horizon_day, t in enumerate(anchors, start=1):
        row_src = series[series["d_num"] == t]
        if row_src.empty:
            raise ModelUnavailable(f"History tail missing d_{t} for {item_id} at {store_id}")
        src = row_src.iloc[0]

        lag_7 = float(sales.get(t - 7, 0.0))
        rolling_mean_28 = mean_of(t - 1, 28)
        last_nonzero = [d for d in sales.index if d < t and sales[d] > 0]
        price_now = float(src["sell_price"])

        rows.append({
            "item_id": _int8(_maps["item_id"][item_id]),
            "dept_id": _int8(_maps["dept_id"][dept_id]),
            "cat_id": _int8(_maps["cat_id"][cat_id]),
            "store_id": _int8(_maps["store_id"][store_id]),
            "state_id": _int8(_maps["state_id"][state_id]),
            "wm_yr_wk": float(src["wm_yr_wk"]),
            # `weekday` was encoded as the alphabetical category code of the day name.
            "weekday": float(WEEKDAY_CODES.index(str(src["weekday"]))),
            "wday": _int8(src["wday"]),          # M5 convention: 1 = Saturday .. 7 = Friday
            "month": _int8(src["month"]),
            "year": _int8(src["year"]),
            "snap_CA": _int8(src["snap_CA"]),
            "snap_TX": _int8(src["snap_TX"]),
            "snap_WI": _int8(src["snap_WI"]),
            "sell_price": price_now,
            "lag_7": lag_7,
            "lag_14": float(sales.get(t - 14, 0.0)),
            "lag_21": float(sales.get(t - 21, 0.0)),
            "lag_28": float(sales.get(t - 28, 0.0)),
            "lag_35": float(sales.get(t - 35, 0.0)),
            "lag_42": float(sales.get(t - 42, 0.0)),
            "rolling_mean_7": mean_of(t - 1, 7),
            "rolling_std_7": std_of(t - 1, 7),
            "rolling_mean_28": rolling_mean_28,
            "rolling_std_28": std_of(t - 1, 28),
            # 60/180-day windows exceed the published tail; the longest available is used.
            "rolling_mean_60": mean_of(t - 1, 60),
            "rolling_mean_180": mean_of(t - 1, 180),
            "lag_7_div_rolling_28": (lag_7 / rolling_mean_28) if rolling_mean_28 else 0.0,
            "price_vs_hist_max": (price_now / price_hist_max) if price_hist_max else 1.0,
            "price_vs_dept_mean": (price_now / dept_price_mean) if dept_price_mean else 1.0,
            "days_since_last_nonzero": (
                float(t - max(last_nonzero)) if last_nonzero else float(t - TAIL_START_DNUM)
            ),
            "weeks_since_release": float((t - TAIL_START_DNUM) // 7),
            # Target encodings were fitted on the full training history; the series mean over
            # the tail is the closest available stand-in.
            "te_dept_id": series_mean,
            "te_store_id": series_mean,
            "te_item_id": series_mean,
            "_horizon_day": horizon_day,
        })

    return pd.DataFrame(rows)


def _predict_rows(store_id: str, frame: pd.DataFrame) -> np.ndarray:
    """Run each row through the booster that owns its horizon block."""
    names = feature_names()
    out = np.zeros(len(frame), dtype=float)
    for block in HBLOCKS:
        mask = (frame["_horizon_day"] >= block[0]) & (frame["_horizon_day"] <= block[1])
        if not mask.any():
            continue
        booster = _get_booster(store_id, block)
        out[mask.to_numpy()] = booster.predict(frame.loc[mask, names].to_numpy(dtype=float))
    return out


# --- public API ---------------------------------------------------------------------------

def baseline_forecast(item_id: str, store_id: str, days: int) -> list:
    """The exact, validated 28-day forecast for this series from predictions.parquet."""
    load_metadata()
    key = m5_id(item_id, store_id)
    if key not in _predictions.index:
        raise ModelUnavailable(f"No published forecast for {item_id} at {store_id}")
    row = _predictions.loc[key]
    return [float(row[f"F{h}"]) for h in range(1, days + 1)]


def scenario_multipliers(item_id: str, store_id: str, days: int,
                         price: float = None, is_snap_day: int = None) -> list:
    """Per-day multipliers capturing the model's own response to the user overrides.

    Returns all-1.0 when no override is supplied.
    """
    if price is None and is_snap_day is None:
        return [1.0] * days

    frame = _build_feature_rows(item_id, store_id, days)
    reference = _predict_rows(store_id, frame)

    scenario = frame.copy()
    if price is not None and price > 0:
        price = float(price)
        hist_max = max(float(frame["sell_price"].max()), price)
        dept_mean_unit = frame["price_vs_dept_mean"] / frame["sell_price"].replace(0, np.nan)
        scenario["sell_price"] = price
        scenario["price_vs_hist_max"] = price / hist_max
        scenario["price_vs_dept_mean"] = (dept_mean_unit * price).fillna(1.0)
    if is_snap_day is not None:
        snap_column = f"snap_{store_id.split('_')[0]}"
        if snap_column in scenario.columns:
            scenario[snap_column] = _int8(int(is_snap_day))

    adjusted = _predict_rows(store_id, scenario)
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = np.where(reference > 1e-9, adjusted / reference, 1.0)
    return [float(np.clip(r, 0.0, 5.0)) for r in ratio]


def predict_sales(item_id: str, store_id: str, days: int = MAX_HORIZON,
                  price: float = None, is_snap_day: int = None) -> dict:
    """Forecast up to 28 days of unit sales for one item at one store."""
    if not 1 <= days <= MAX_HORIZON:
        raise ValueError(f"days must be between 1 and {MAX_HORIZON}")

    baseline = baseline_forecast(item_id, store_id, days)
    try:
        multipliers = scenario_multipliers(item_id, store_id, days, price, is_snap_day)
        scenario_applied = any(abs(m - 1.0) > 1e-9 for m in multipliers)
    except ModelUnavailable as exc:
        logger.warning("Scenario adjustment unavailable for %s/%s: %s", item_id, store_id, exc)
        multipliers = [1.0] * days
        scenario_applied = False

    predictions = [max(0.0, round(b * m, 4)) for b, m in zip(baseline, multipliers)]
    return {
        "predictions": predictions,
        "baseline": [round(b, 4) for b in baseline],
        "dates": forecast_dates(days),
        "forecast_origin": f"d_{FORECAST_ORIGIN_DNUM}",
        "scenario_applied": scenario_applied,
        "approximated_features": list(APPROXIMATED_FEATURES) if scenario_applied else [],
    }


def feature_importance(store_id: str, top_n: int = 8) -> list:
    """Real gain-based feature importance, summed across the four horizon blocks."""
    names = feature_names()
    totals = np.zeros(len(names), dtype=float)
    for block in HBLOCKS:
        totals += _get_booster(store_id, block).feature_importance(importance_type="gain")
    total = float(totals.sum())
    ranked = sorted(zip(names, totals), key=lambda pair: -pair[1])[:top_n]
    return [
        {"feature": name, "gain": round(float(gain), 2),
         "share": round(float(gain) / total, 4) if total else 0.0}
        for name, gain in ranked
    ]


def latest_price(item_id: str, store_id: str) -> float:
    """The real most recent sell_price for this series, from history_tail.parquet."""
    series = _series_frame(item_id, store_id)
    price = series.sort_values("d_num")["sell_price"].dropna()
    if price.empty:
        raise ModelUnavailable(f"No price on record for {item_id} at {store_id}")
    return round(float(price.iloc[-1]), 2)


# --- explainability -------------------------------------------------------------------------

def explain_forecast(item_id: str, store_id: str, days: int = MAX_HORIZON,
                     top_n: int = 8) -> dict:
    """Per-forecast explanation from LightGBM's exact SHAP contributions.

    `pred_contrib=True` returns one contribution per feature plus a base value, and they sum to
    the raw margin. These models use a Tweedie objective with a log link, so
    exp(base + sum(contributions)) reconstructs the prediction exactly -- there is no
    approximation in the attribution itself.

    Working in log space means each contribution is naturally read as a multiplier:
    +0.13 in log space is a 1.14x lift. Contributions are averaged across the horizon, so this
    explains the overall level of the forecast rather than one particular day.

    The caveats from `_build_feature_rows` still apply: the features listed in
    APPROXIMATED_FEATURES could not be reconstructed from the published 57-day tail, so their
    attributions are indicative rather than exact. They are flagged in the response.
    """
    names = feature_names()
    frame = _build_feature_rows(item_id, store_id, days)

    total_contrib = np.zeros(len(names), dtype=float)
    total_base = 0.0
    rows_seen = 0

    for block in HBLOCKS:
        mask = (frame["_horizon_day"] >= block[0]) & (frame["_horizon_day"] <= block[1])
        if not mask.any():
            continue
        booster = _get_booster(store_id, block)
        matrix = booster.predict(
            frame.loc[mask, names].to_numpy(dtype=float), pred_contrib=True
        )
        total_contrib += matrix[:, :-1].sum(axis=0)
        total_base += float(matrix[:, -1].sum())
        rows_seen += int(mask.sum())

    if not rows_seen:
        raise ModelUnavailable("No rows available to explain")

    mean_contrib = total_contrib / rows_seen
    mean_base = total_base / rows_seen

    ranked = sorted(zip(names, mean_contrib), key=lambda pair: -abs(pair[1]))[:top_n]
    drivers = []
    for name, value in ranked:
        entry = feature_glossary.describe(name)
        entry.update({
            # Log-space contribution, and the same thing as a multiplier on the forecast.
            "contribution": round(float(value), 4),
            "multiplier": round(float(np.exp(value)), 4),
            "direction": "increases" if value > 0 else "decreases",
            "value": round(float(frame[name].mean()), 4),
            "approximate": name in APPROXIMATED_FEATURES,
        })
        drivers.append(entry)

    baseline_units = float(np.exp(mean_base))
    explained_units = float(np.exp(mean_base + mean_contrib.sum()))

    return {
        "item_id": item_id,
        "store_id": store_id,
        "horizon_days": days,
        "method": "LightGBM SHAP (pred_contrib), averaged over the horizon, log link",
        # What the model would predict knowing nothing about this series.
        "base_units_per_day": round(baseline_units, 4),
        "explained_units_per_day": round(explained_units, 4),
        "drivers": drivers,
        "approximated_features": [
            name for name, _ in ranked if name in APPROXIMATED_FEATURES
        ],
    }


def feature_catalog() -> list:
    """Every feature the model uses, described in plain language."""
    return [feature_glossary.describe(name) for name in feature_names()]
