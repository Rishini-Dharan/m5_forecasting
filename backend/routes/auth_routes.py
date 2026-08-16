from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db.db import db
from utils.auth_utils import encrypt_password, verify_password, create_jwt_token

router = APIRouter()

class UserSignup(BaseModel):
    email: str
    password: str
    role: str # e.g., 'ADMIN' or 'STORE_MANAGER'
    store_id: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

@router.post("/signup")
def signup(req: UserSignup):
    encrypted_pass = encrypt_password(req.password)
    
    sql = "INSERT INTO users (email, password_hash, role, store_id) VALUES (%s, %s, %s, %s) RETURNING id;"
    params = (req.email, encrypted_pass, req.role, req.store_id)
    
    result = db.execute_query(sql, params, fetch=True)
    if result:
        return {"status": "success",
                "message": "User created!", 
                "user_id": result[0][0]
            }
    
    raise HTTPException(status_code=400, detail="Signup failed. Email might already exist.")

@router.post("/login")
def login(req: UserLogin):
    sql = "SELECT id, email, password_hash, role, store_id FROM users WHERE email = %s;"
    result = db.execute_query(sql, (req.email,), fetch=True)
    
    if not result or len(result) == 0:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    user = result[0]
    db_password_hash = user[2]
    role = user[3]
    store_id = user[4]
    
    if not verify_password(req.password, db_password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    token = create_jwt_token(email=req.email, role=role, store_id=store_id)
    
    return {
        "status": "success",
        "access_token": token,
        "token_type": "bearer",
        "role": role,
        "store_id": store_id
    }
