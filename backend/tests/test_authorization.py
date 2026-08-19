"""Regression tests for the store-scoping holes.

Every check used to read `if user_store and req.store_id != user_store`, so a STORE_OWNER with
a null store_id fell through every one of them, and /stores and /store/{id} had no check at all.
"""

import pytest
from fastapi import HTTPException

from utils.authz import assert_store_access, require_admin, scope_filter


def test_admin_reaches_any_store():
    assert_store_access({"role": "ADMIN", "store_id": None}, "WI_3") is None


def test_owner_reaches_own_store():
    assert_store_access({"role": "STORE_OWNER", "store_id": "CA_1"}, "CA_1") is None


def test_owner_blocked_from_other_store():
    with pytest.raises(HTTPException) as exc:
        assert_store_access({"role": "STORE_OWNER", "store_id": "CA_1"}, "TX_2")
    assert exc.value.status_code == 403


@pytest.mark.parametrize("store_id", [None, ""])
def test_storeless_owner_is_denied(store_id):
    """The core regression: no assigned store must mean no access, not unrestricted access."""
    with pytest.raises(HTTPException) as exc:
        assert_store_access({"role": "STORE_OWNER", "store_id": store_id}, "CA_1")
    assert exc.value.status_code == 403


def test_unknown_role_is_denied():
    with pytest.raises(HTTPException) as exc:
        assert_store_access({"role": "VENDOR", "store_id": "CA_1"}, "CA_1")
    assert exc.value.status_code == 403


def test_scope_filter_scopes_owner_and_not_admin():
    assert scope_filter({"role": "ADMIN"}) == ("", [])
    assert scope_filter({"role": "STORE_OWNER", "store_id": "TX_1"}) == (
        "WHERE store_id = %s", ["TX_1"]
    )
    with pytest.raises(HTTPException):
        scope_filter({"role": "STORE_OWNER", "store_id": None})


def test_require_admin():
    require_admin({"role": "ADMIN"})
    with pytest.raises(HTTPException) as exc:
        require_admin({"role": "STORE_OWNER", "store_id": "CA_1"})
    assert exc.value.status_code == 403


def test_stores_endpoint_denies_storeless_owner(client, storeless_owner_token, fake_db, auth):
    response = client.get("/api/data/stores", headers=auth(storeless_owner_token))
    assert response.status_code == 403


def test_stores_endpoint_scopes_owner_to_own_store(client, owner_token, fake_db, auth):
    response = client.get("/api/data/stores", headers=auth(owner_token))
    assert response.status_code == 200
    assert response.json()["stores"] == ["CA_1"]


def test_store_details_denies_cross_store(client, owner_token, fake_db, auth):
    response = client.get("/api/data/store/WI_2", headers=auth(owner_token))
    assert response.status_code == 403


def test_predict_denies_cross_store(client, owner_token, fake_db, auth):
    response = client.post(
        "/api/predict",
        json={"item_id": "FOODS_1_001", "store_id": "TX_1", "forecast_days": 7},
        headers=auth(owner_token),
    )
    assert response.status_code == 403
