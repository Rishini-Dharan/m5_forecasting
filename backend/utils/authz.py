"""Shared store-level access control.

Every route previously wrote `if user_store and req.store_id != user_store`, which let a
STORE_OWNER whose store_id is null or empty through every check and see every store. The rule
lives here once instead, and denies rather than falls open.
"""

from fastapi import HTTPException

ADMIN = "ADMIN"
STORE_OWNER = "STORE_OWNER"


def is_admin(current_user: dict) -> bool:
    return current_user.get("role") == ADMIN


def owned_store(current_user: dict):
    """The store this user is scoped to, or None for an admin."""
    if is_admin(current_user):
        return None
    return current_user.get("store_id") or None


def require_admin(current_user: dict) -> None:
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Forbidden. Admin role required.")


def assert_store_access(current_user: dict, store_id: str) -> None:
    """Allow admins anywhere; allow a store owner only into their own assigned store."""
    if is_admin(current_user):
        return
    if current_user.get("role") != STORE_OWNER:
        raise HTTPException(status_code=403, detail="Access denied: unrecognised role")

    user_store = current_user.get("store_id")
    if not user_store:
        raise HTTPException(
            status_code=403,
            detail="Access denied: no store is assigned to this account",
        )
    if store_id != user_store:
        raise HTTPException(
            status_code=403,
            detail="Access denied: you can only access your assigned store",
        )


def scope_filter(current_user: dict):
    """(sql_fragment, params) restricting a historical_sales query to what the user may see."""
    if is_admin(current_user):
        return "", []

    user_store = current_user.get("store_id")
    if not user_store:
        raise HTTPException(
            status_code=403,
            detail="Access denied: no store is assigned to this account",
        )
    return "WHERE store_id = %s", [user_store]
