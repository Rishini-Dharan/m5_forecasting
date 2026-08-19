from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
import logging

from models.model_loader import get_model, predict_sales_30day
from utils.auth_utils import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

class PredictionRequest(BaseModel):
    item_id: str = Field(..., description="Item ID (e.g., HOBBIES_1_001)")
    store_id: str = Field(..., description="Store ID (e.g., CA_1)")
    price: float = Field(..., gt=0, description="Item price")
    is_weekend: int = Field(0, ge=0, le=1, description="1 if weekend, 0 otherwise")
    is_snap_day: int = Field(0, ge=0, le=1, description="1 if SNAP day, 0 otherwise")
    forecast_days: int = Field(30, ge=1, le=90, description="Number of days to forecast")

class PredictionResponse(BaseModel):
    status: str
    item_id: str
    store_id: str
    predictions: List[float]
    forecast_days: int

class ModelInfoResponse(BaseModel):
    status: str
    model_loaded: bool
    model_path: str

@router.get("/model/info", response_model=ModelInfoResponse)
def model_info():
    """Check if model is loaded and get model info."""
    mdl = get_model()
    return ModelInfoResponse(
        status="success",
        model_loaded=mdl is not None,
        model_path=MODEL_PATH
    )

@router.post("/predict", response_model=PredictionResponse)
def predict_sales(req: PredictionRequest, current_user: dict = Depends(get_current_user)):
    """Generate 30-day sales forecast for an item at a store."""
    try:
        # Check store access for STORE_OWNER
        if current_user.get("role") == "STORE_OWNER":
            user_store = current_user.get("store_id")
            if user_store and req.store_id != user_store:
                raise HTTPException(status_code=403, detail="Access denied: You can only forecast for your assigned store")
        
        mdl = get_model()
        if mdl is None:
            raise HTTPException(status_code=503, detail="Model not loaded")
        
        predictions = predict_sales_30day(
            item_id=req.item_id,
            store_id=req.store_id,
            base_price=req.price,
            is_weekend=req.is_weekend,
            is_snap_day=req.is_snap_day,
            days=req.forecast_days
        )
        
        # Log prediction to database
        from db.db import db
        log_query = """
        INSERT INTO predictions (user_id, item_id, store_id, features_json, predicted_value)
        VALUES (%s, %s, %s, %s, %s)
        """
        import json
        
        # Get user_id from email (sub field in JWT)
        user_query = "SELECT id FROM users WHERE email = %s;"
        user_result = db.execute_query(user_query, (current_user.get("sub"),), fetch=True)
        user_id = user_result[0]["id"] if user_result else None
        
        features = {
            "price": req.price,
            "is_weekend": req.is_weekend,
            "is_snap_day": req.is_snap_day,
            "forecast_days": req.forecast_days
        }
        db.execute_query(log_query, (
            user_id,
            req.item_id,
            req.store_id,
            json.dumps(features),
            predictions[0] if predictions else 0
        ))
        
        return PredictionResponse(
            status="success",
            item_id=req.item_id,
            store_id=req.store_id,
            predictions=predictions,
            forecast_days=req.forecast_days
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Import MODEL_PATH from model_loader
from models.model_loader import MODEL_PATH