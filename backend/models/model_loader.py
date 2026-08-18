import os
import logging
import lightgbm as lgb
import numpy as np
from huggingface_hub import hf_hub_download

from config import settings

logger = logging.getLogger(__name__)

MODEL_PATH = settings.MODEL_PATH
model = None

def download_model_from_hf():
    """Download model from Hugging Face Hub if not present locally."""
    if not os.path.exists(MODEL_PATH):
        logger.info(f"Model not found at {MODEL_PATH}, downloading from Hugging Face...")
        try:
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            hf_hub_download(
                repo_id=settings.HF_MODEL_REPO,
                filename=settings.HF_MODEL_FILENAME,
                local_dir=os.path.dirname(MODEL_PATH),
                local_dir_use_symlinks=False
            )
            # The file might be downloaded with a different name, rename it
            downloaded_path = os.path.join(os.path.dirname(MODEL_PATH), settings.HF_MODEL_FILENAME)
            if downloaded_path != MODEL_PATH and os.path.exists(downloaded_path):
                os.rename(downloaded_path, MODEL_PATH)
            logger.info(f"Model downloaded successfully to {MODEL_PATH}")
        except Exception as e:
            logger.error(f"Failed to download model from HF: {e}")
            raise
    else:
        logger.info(f"Model already exists at {MODEL_PATH}")

def load_lgb_model():
    global model
    try:
        download_model_from_hf()
        logger.info("Loading LightGBM model...")
        model = lgb.Booster(model_file=MODEL_PATH)
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        model = None
        raise

def get_model():
    global model
    if model is None:
        load_lgb_model()
    return model

def predict_sales_30day(item_id: str, store_id: str, base_price: float, is_weekend: int, is_snap_day: int, days: int = 30):
    """Generate 30-day forecast using the LightGBM model."""
    mdl = get_model()
    if mdl is None:
        raise ValueError("Model not loaded")
    
    predictions = []
    current_price = base_price
    
    for day in range(1, days + 1):
        # Simulate price variations and calendar effects
        # In production, you'd have actual future features
        features = [[current_price, is_weekend, is_snap_day]]
        pred = mdl.predict(features)
        predictions.append(max(0, float(pred[0])))
        
        # Simple price drift simulation
        current_price *= 1.001
    
    return predictions