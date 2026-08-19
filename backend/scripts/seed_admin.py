"""Seed the initial admin account.

Credentials come from the environment so they are not hardcoded in the repo. The defaults keep
the demo working out of the box; override them for anything that is reachable from outside.
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.db import db, init_db  # noqa: E402
from utils.auth_utils import encrypt_password  # noqa: E402

DEFAULT_EMAIL = "admin@m5.com"
DEFAULT_PASSWORD = "adminpassword"


def seed_admin():
    email = os.getenv("SEED_ADMIN_EMAIL", DEFAULT_EMAIL).strip().lower()
    password = os.getenv("SEED_ADMIN_PASSWORD", DEFAULT_PASSWORD)

    init_db()

    existing = db.execute_query("SELECT id FROM users WHERE email = %s;", (email,), fetch_one=True)
    if existing:
        print(f"[OK] Admin account already exists: {email}")
        return

    db.execute_query(
        "INSERT INTO users (email, password_hash, role, store_id) VALUES (%s, %s, %s, %s) RETURNING id;",
        (email, encrypt_password(password), "ADMIN", None),
        fetch_one=True,
    )
    print(f"[OK] Seeded admin account: {email}")
    if password == DEFAULT_PASSWORD:
        print("[WARN] Using the default password. Set SEED_ADMIN_PASSWORD to change it.")


if __name__ == "__main__":
    seed_admin()
