import psycopg2
import pytest

from utils.auth_utils import create_jwt_token, encrypt_password, verify_password


def test_password_round_trip():
    hashed = encrypt_password("correct-horse")
    assert verify_password("correct-horse", hashed)
    assert not verify_password("wrong", hashed)


def test_malformed_hash_fails_closed():
    assert verify_password("anything", "not-a-bcrypt-hash") is False


def test_login_success(client, fake_db):
    fake_db.return_value = {
        "id": 1, "email": "a@b.com", "password_hash": encrypt_password("password123"),
        "role": "ADMIN", "store_id": None,
    }
    response = client.post("/auth/login", json={"email": "a@b.com", "password": "password123"})
    assert response.status_code == 200
    assert response.json()["role"] == "ADMIN"
    assert response.json()["access_token"]


def test_login_wrong_password(client, fake_db):
    fake_db.return_value = {
        "id": 1, "email": "a@b.com", "password_hash": encrypt_password("password123"),
        "role": "ADMIN", "store_id": None,
    }
    response = client.post("/auth/login", json={"email": "a@b.com", "password": "nope"})
    assert response.status_code == 401


def test_login_unknown_email(client, fake_db):
    fake_db.return_value = None
    response = client.post("/auth/login", json={"email": "ghost@b.com", "password": "whatever"})
    assert response.status_code == 401


def test_duplicate_email_returns_400_not_500(client, fake_db, admin_token, auth):
    """This used to escape as an unhandled IntegrityError and surface as a 500."""
    fake_db.side_effect = psycopg2.IntegrityError("duplicate key")
    response = client.post(
        "/auth/create-user",
        json={"email": "dupe@b.com", "password": "password123", "role": "ADMIN"},
        headers=auth(admin_token),
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_store_owner_requires_store_id(client, fake_db, admin_token, auth):
    response = client.post(
        "/auth/create-user",
        json={"email": "o@b.com", "password": "password123", "role": "STORE_OWNER"},
        headers=auth(admin_token),
    )
    assert response.status_code == 400


def test_invalid_role_rejected(client, fake_db, admin_token, auth):
    response = client.post(
        "/auth/create-user",
        json={"email": "o@b.com", "password": "password123", "role": "SUPERUSER"},
        headers=auth(admin_token),
    )
    assert response.status_code == 422


def test_non_admin_cannot_create_users(client, fake_db, owner_token, auth):
    response = client.post(
        "/auth/create-user",
        json={"email": "o@b.com", "password": "password123", "role": "ADMIN"},
        headers=auth(owner_token),
    )
    assert response.status_code == 403


def test_missing_and_bad_tokens_rejected(client, fake_db, auth):
    assert client.get("/auth/users").status_code == 403
    assert client.get("/auth/users", headers=auth("garbage.token.here")).status_code == 401


def test_expired_token_rejected(client, fake_db, monkeypatch, auth):
    from config import settings

    monkeypatch.setattr(type(settings), "JWT_EXPIRATION_HOURS", -1)
    token = create_jwt_token(email="a@b.com", role="ADMIN", store_id=None)
    assert client.get("/auth/users", headers=auth(token)).status_code == 401
