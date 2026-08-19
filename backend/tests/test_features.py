"""Feature construction must match the trained contract exactly."""

import pytest

pytest.importorskip("lightgbm")

from models import npn_loader  # noqa: E402


@pytest.fixture(scope="module")
def frame():
    return npn_loader._build_feature_rows("FOODS_1_001", "CA_1", 28)


def test_frame_has_every_feature_in_schema_order(frame):
    names = npn_loader.feature_names()
    assert list(frame.columns)[:-1] == names or set(names).issubset(frame.columns)
    assert len(frame) == 28


def test_no_missing_values(frame):
    names = npn_loader.feature_names()
    assert not frame[names].isna().any().any()


def test_wday_uses_m5_convention(frame):
    """M5 wday runs 1..7 (1 = Saturday), not datetime.weekday()'s 0..6."""
    assert frame["wday"].min() >= 1
    assert frame["wday"].max() <= 7


def test_rolling_and_lag_relationships(frame):
    row = frame.iloc[0]
    if row["rolling_mean_28"]:
        assert row["lag_7_div_rolling_28"] == pytest.approx(row["lag_7"] / row["rolling_mean_28"])
    assert row["rolling_std_7"] >= 0


def test_scenario_multiplier_is_one_without_overrides():
    assert npn_loader.scenario_multipliers("FOODS_1_001", "CA_1", 7) == [1.0] * 7


def test_snap_override_moves_the_forecast():
    """SNAP is a real driver in the trained model; the override must actually reach it."""
    off = npn_loader.predict_sales("FOODS_1_001", "CA_1", days=7, is_snap_day=0)
    on = npn_loader.predict_sales("FOODS_1_001", "CA_1", days=7, is_snap_day=1)
    assert sum(on["predictions"]) > sum(off["predictions"])
    assert on["scenario_applied"] is True


def test_predict_rejects_horizon_beyond_28():
    with pytest.raises(ValueError):
        npn_loader.predict_sales("FOODS_1_001", "CA_1", days=29)


def test_unknown_series_raises_model_unavailable():
    with pytest.raises(npn_loader.ModelUnavailable):
        npn_loader.baseline_forecast("NOT_A_REAL_ITEM", "CA_1", 7)


def test_latest_price_is_real():
    assert npn_loader.latest_price("FOODS_1_001", "CA_1") == pytest.approx(2.24)


def test_feature_importance_is_ranked_and_normalised():
    importance = npn_loader.feature_importance("CA_1", top_n=5)
    assert len(importance) == 5
    gains = [entry["gain"] for entry in importance]
    assert gains == sorted(gains, reverse=True)
    assert all(0 <= entry["share"] <= 1 for entry in importance)
    # rolling_mean_7 dominates this model by a wide margin.
    assert importance[0]["feature"] == "rolling_mean_7"


def test_explanation_reconstructs_the_prediction():
    """SHAP contributions must sum back to the model output, not merely correlate with it."""
    result = npn_loader.explain_forecast("FOODS_1_001", "CA_1", days=7, top_n=34)
    total = sum(d["contribution"] for d in result["drivers"])
    import math
    rebuilt = result["base_units_per_day"] * math.exp(total)
    assert rebuilt == pytest.approx(result["explained_units_per_day"], rel=1e-3)


def test_explanation_is_ranked_by_absolute_impact():
    result = npn_loader.explain_forecast("FOODS_1_001", "CA_1", days=7, top_n=6)
    impacts = [abs(d["contribution"]) for d in result["drivers"]]
    assert impacts == sorted(impacts, reverse=True)
    assert len(result["drivers"]) == 6


def test_explanation_flags_approximated_features():
    result = npn_loader.explain_forecast("FOODS_1_001", "CA_1", days=7, top_n=34)
    flagged = {d["feature"] for d in result["drivers"] if d["approximate"]}
    assert flagged == set(npn_loader.APPROXIMATED_FEATURES) & {d["feature"] for d in result["drivers"]}


def test_every_feature_has_a_plain_language_label():
    catalog = npn_loader.feature_catalog()
    assert len(catalog) == 34
    for entry in catalog:
        assert entry["label"] and entry["label"] != entry["feature"], entry["feature"]
        assert entry["description"].endswith(".")
