import logging
import re
from typing import List, Optional

import psycopg2
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from db.db import db
from utils.auth_utils import create_jwt_token, encrypt_password, get_current_user, verify_password
from utils.authz import require_admin

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_ROLES = ("ADMIN", "STORE_OWNER")


class AdminCreateUser(BaseModel):
    email: str
    password: str
    role: str
    store_id: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", value):
            raise ValueError("Invalid email format")
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value):
        if value not in VALID_ROLES:
            raise ValueError(f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
        return value


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    store_id: Optional[str] = None


@router.post("/create-user")
def create_user(req: AdminCreateUser, current_user: dict = Depends(get_current_user)):
    require_admin(current_user)

    # A store owner without a store cannot see anything, so reject that up front rather than
    # creating an account that fails every authorisation check.
    if req.role == "STORE_OWNER" and not req.store_id:
        raise HTTPException(status_code=400, detail="STORE_OWNER requires a store_id")

    try:
        result = db.execute_query(
            "INSERT INTO users (email, password_hash, role, store_id) VALUES (%s, %s, %s, %s) RETURNING id;",
            (req.email, encrypt_password(req.password), req.role, req.store_id),
            fetch_one=True,
        )
    except psycopg2.IntegrityError:
        # Previously this surfaced as a 500 -- the intended 400 was unreachable.
        raise HTTPException(status_code=400, detail="A user with that email already exists")
    except Exception:
        logger.exception("User creation failed")
        raise HTTPException(status_code=500, detail="Could not create user")

    if not result:
        raise HTTPException(status_code=500, detail="Could not create user")

    return {
        "status": "success",
        "message": f"User {req.email} created as {req.role}",
        "user_id": result["id"],
    }


@router.post("/login")
def login(req: UserLogin):
    user = db.execute_query(
        "SELECT id, email, password_hash, role, store_id FROM users WHERE email = %s;",
        (req.email.strip().lower(),),
        fetch_one=True,
    )

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_jwt_token(
        email=user["email"], role=user["role"], store_id=user["store_id"]
    )
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "role": user["role"],
        "store_id": user["store_id"],
    }


@router.get("/users", response_model=List[UserResponse])
def list_users(current_user: dict = Depends(get_current_user)):
    """List all users. Admin only."""
    require_admin(current_user)
    results = db.execute_query(
        "SELECT id, email, role, store_id FROM users ORDER BY created_at DESC;", fetch=True
    )
    return [
        UserResponse(id=row["id"], email=row["email"], role=row["role"], store_id=row["store_id"])
        for row in results or []
    ]
