import os
import sys
from unittest.mock import MagicMock

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault("ENVIRONMENT", "test")


@pytest.fixture
def fake_db(monkeypatch):
    """Replace Database.execute_query so no test needs a live PostgreSQL."""
    from db import db as db_module

    fake = MagicMock()
    monkeypatch.setattr(db_module.db, "execute_query", fake)
    return fake


@pytest.fixture
def client(monkeypatch):
    """TestClient with startup side effects stubbed out."""
    from fastapi.testclient import TestClient

    import db.db as db_module

    monkeypatch.setattr(db_module, "init_db", lambda: None)
    monkeypatch.setattr(db_module.db, "close_pool", lambda: None)

    import main

    monkeypatch.setattr(main, "init_db", lambda: None)
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def admin_token():
    from utils.auth_utils import create_jwt_token

    return create_jwt_token(email="admin@m5.com", role="ADMIN", store_id=None)


@pytest.fixture
def owner_token():
    from utils.auth_utils import create_jwt_token

    return create_jwt_token(email="owner@m5.com", role="STORE_OWNER", store_id="CA_1")


@pytest.fixture
def storeless_owner_token():
    """A STORE_OWNER with no assigned store -- the case that used to bypass every check."""
    from utils.auth_utils import create_jwt_token

    return create_jwt_token(email="nostore@m5.com", role="STORE_OWNER", store_id=None)


@pytest.fixture
def auth():
    """Build an Authorization header. A fixture, not an import, because a globally installed
    `tests` package would otherwise shadow `tests.conftest`."""
    def _auth(token):
        return {"Authorization": f"Bearer {token}"}
    return _auth
