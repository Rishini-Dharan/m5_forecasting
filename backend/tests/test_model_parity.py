"""Locks the model contract.

The published parity fixture is a frozen set of feature rows plus the predictions the trained
boosters produced for them. If loading, feature ordering, or the LightGBM version ever drifts,
this test fails before anyone sees a wrong forecast.
"""

import numpy as np
import pytest

pytest.importorskip("lightgbm")

from models import npn_loader  # noqa: E402


@pytest.fixture(scope="module")
def fixture_data():
    import pandas as pd
    from huggingface_hub import hf_hub_download

    from config import settings

    features = pd.read_parquet(
        hf_hub_download(settings.NPN_REPO, "parity_fixture.parquet")
    )
    expected = pd.read_parquet(
        hf_hub_download(settings.NPN_REPO, "parity_predictions.parquet")
    )
    return features, expected


def test_feature_schema_matches_boosters(fixture_data):
    names = npn_loader.feature_names()
    assert len(names) == 34
    for block in npn_loader.HBLOCKS:
        booster = npn_loader._get_booster("CA_1", block)
        assert booster.feature_name() == names
        assert booster.num_feature() == 34


@pytest.mark.parametrize("store_id", ["CA_1", "TX_1"])
def test_predictions_match_published_parity(fixture_data, store_id):
    features, expected = fixture_data
    names = npn_loader.feature_names()

    for block in npn_loader.HBLOCKS:
        key = f"{store_id}_hblock=block_{block[0]}_{block[1]}"
        rows = features[features["model_key"] == key]
        if rows.empty:
            continue

        booster = npn_loader._get_booster(store_id, block)
        actual = booster.predict(rows[names].to_numpy(dtype=float))

        wanted = expected.set_index(["model_key", "row_index"]).loc[
            [(key, i) for i in rows["row_index"]], "prediction"
        ].to_numpy()

        assert np.abs(actual - wanted).max() < 1e-9, f"drift in {key}"


def test_baseline_matches_published_predictions():
    """The served baseline must be the validated output, not a recomputation of it."""
    import pandas as pd
    from huggingface_hub import hf_hub_download

    from config import settings

    published = pd.read_parquet(
        hf_hub_download(settings.NPN_REPO, "predictions.parquet")
    ).set_index("id")

    served = npn_loader.baseline_forecast("FOODS_1_001", "CA_1", 28)
    wanted = [float(published.loc["FOODS_1_001_CA_1_evaluation"][f"F{h}"]) for h in range(1, 29)]
    assert np.allclose(served, wanted)


def test_int8_wrap_is_reproduced():
    """Categorical codes were wrapped to int8 during training; we must wrap identically."""
    assert npn_loader._int8(0) == 0
    assert npn_loader._int8(127) == 127
    assert npn_loader._int8(128) == -128
    assert npn_loader._int8(212) == -44      # matches item_id in the published fixture
    assert npn_loader._int8(2016) == -32     # matches year in the published fixture


def test_horizon_blocks_cover_exactly_28_days():
    assert npn_loader.MAX_HORIZON == 28
    covered = [d for lo, hi in npn_loader.HBLOCKS for d in range(lo, hi + 1)]
    assert covered == list(range(1, 29))
    assert npn_loader.block_for_horizon(1) == (1, 7)
    assert npn_loader.block_for_horizon(28) == (22, 28)
    with pytest.raises(ValueError):
        npn_loader.block_for_horizon(29)
