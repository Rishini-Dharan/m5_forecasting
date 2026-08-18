from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from config import settings
from db.db import db, init_db
from routes.auth_routes import router as auth_router
from routes.predict_routes import router as predict_router
from routes.data_routes import router as data_router
from models import load_lgb_model

app = FastAPI(title="M5 Forecasting Engine", version="1.0.0")

# --- Logging ---
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    logger.info("Starting up M5 Forecasting Engine...")
    init_db()
    try:
        load_lgb_model()
        logger.info("Model loaded successfully on startup")
    except Exception as e:
        logger.warning(f"Model not loaded on startup: {e}")

@app.on_event("shutdown")
def shutdown_event():
    logger.info("Shutting down...")
    db.close_pool()

@app.get("/")
def read_root():
    return {
        "name": "M5 Forecasting Engine",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# --- Hook up the Routers ---
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(predict_router, prefix="/api", tags=["Prediction"])
app.include_router(data_router, prefix="/api/data", tags=["Data"])