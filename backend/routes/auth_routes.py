from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db.db import db
from utils.auth_utils import encrypt_password, verify_password, create_jwt_token, get_current_user

router = APIRouter()

class AdminCreateUser(BaseModel):
    email: str
    password: str
    role: str # 'ADMIN' or 'STORE_OWNER'
    store_id: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

@router.post("/create-user")
def create_user(req: AdminCreateUser, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Forbidden. Only Admins can create users.")

    if req.role not in ["ADMIN", "STORE_OWNER"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be ADMIN or STORE_OWNER.")

    encrypted_pass = encrypt_password(req.password)
    
    sql = "INSERT INTO users (email, password_hash, role, store_id) VALUES (%s, %s, %s, %s) RETURNING id;"
    params = (req.email, encrypted_pass, req.role, req.store_id)
    
    result = db.execute_query(sql, params, fetch=True)
    if result:
        return {"status": "success",
                "message": f"User {req.email} created as {req.role}!", 
                "user_id": result[0][0]
            }
    
    raise HTTPException(status_code=400, detail="Creation failed. Email might already exist.")

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
