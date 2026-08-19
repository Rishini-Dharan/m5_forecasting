"""Smoke tests for the public surface, with the database and model stubbed."""

import pytest


def test_root_and_health(client):
    assert client.get("/").status_code == 200
    body = client.get("/health").json()
    assert body["status"] == "healthy"
    assert "model_loaded" in body


def test_model_info_never_downloads(client, monkeypatch):
    """This endpoint used to trigger a full model load and 500 when the model was missing."""
    from models import npn_loader

    def explode(*args, **kwargs):
        raise AssertionError("model_info must not touch the artifacts")

    monkeypatch.setattr(npn_loader, "_download", explode)
    response = client.get("/api/model/info")
    assert response.status_code == 200
    assert response.json()["max_horizon"] == 28


def test_predict_rejects_horizon_over_28(client, owner_token, fake_db, auth):
    response = client.post(
        "/api/predict",
        json={"item_id": "FOODS_1_001", "store_id": "CA_1", "forecast_days": 29},
        headers=auth(owner_token),
    )
    assert response.status_code == 422


def test_predict_rejects_non_positive_price(client, owner_token, fake_db, auth):
    response = client.post(
        "/api/predict",
        json={"item_id": "FOODS_1_001", "store_id": "CA_1", "price": 0},
        headers=auth(owner_token),
    )
    assert response.status_code == 422


def test_predict_succeeds_and_logging_failure_is_not_fatal(client, owner_token, monkeypatch, fake_db, auth):
    """A broken predictions-table insert must not turn a good forecast into a 500."""
    from models import npn_loader
    import routes.predict_routes as predict_routes

    monkeypatch.setattr(npn_loader, "predict_sales", lambda **kwargs: {
        "predictions": [1.0, 2.0], "baseline": [1.0, 2.0],
        "dates": ["2016-05-23", "2016-05-24"], "forecast_origin": "d_1941",
        "scenario_applied": False, "approximated_features": [],
    })
    monkeypatch.setattr(predict_routes.db, "execute_query",
                        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("db down")))

    response = client.post(
        "/api/predict",
        json={"item_id": "FOODS_1_001", "store_id": "CA_1", "forecast_days": 2},
        headers=auth(owner_token),
    )
    assert response.status_code == 200
    assert response.json()["predictions"] == [1.0, 2.0]


def test_prediction_errors_do_not_leak_internals(client, owner_token, monkeypatch, fake_db, auth):
    from models import npn_loader

    def boom(**kwargs):
        raise RuntimeError("connection string postgres://secret@host/db")

    monkeypatch.setattr(npn_loader, "predict_sales", boom)
    response = client.post(
        "/api/predict",
        json={"item_id": "FOODS_1_001", "store_id": "CA_1"},
        headers=auth(owner_token),
    )
    assert response.status_code == 500
    assert "secret" not in response.json()["detail"]


def test_insights_returns_empty_state_not_fake_numbers(client, admin_token, fake_db, auth):
    """The old fallback invented '$24.8M' and 'Enterprise Licensing' out of thin air."""
    fake_db.return_value = []
    body = client.get("/api/data/insights", headers=auth(admin_token)).json()
    assert body["data_available"] is False
    assert body["key_drivers"] == []
    assert "$24.8M" not in str(body)


def test_all_data_routes_require_auth(client):
    for path in ["/api/data/stores", "/api/data/items", "/api/data/insights",
                 "/api/data/store/CA_1", "/api/data/price?item_id=X&store_id=CA_1"]:
        assert client.get(path).status_code == 403, path
