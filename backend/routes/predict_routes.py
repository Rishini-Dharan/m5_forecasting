from fastapi import APIRouter
from pydantic import BaseModel
import lightgbm as lgb
import os

router = APIRouter()

MODEL_PATH = "models/lgb_model.txt"
model = None

def load_lgb_model():
    """Loads the model into memory. Called by main.py startup event."""
    global model
    if os.path.exists(MODEL_PATH):
        print("Loading Model...") 
        model = lgb.Booster(model_file=MODEL_PATH)
        print("Model Loaded Success")
    else:
        print(f"Warning: Model Not Found at {MODEL_PATH}")

class PredictionRequest(BaseModel):
    item_id: str
    store_id: str
    price: float
    is_weekend: int
    is_snap_day: int

@router.post("/predict")
def predict_sales(req: PredictionRequest):
    if model is None:
        return {
            "status": "mock",
            "model": "Not Available"
        }

    features = [[
        req.price,
        req.is_weekend,
        req.is_snap_day
    ]]

    prediction = model.predict(features)

    return {
        "status": "success",
        "item_id": req.item_id,
        "predicted_sales": float(prediction[0])
    }
