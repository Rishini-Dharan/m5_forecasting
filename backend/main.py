import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db.db import db, init_db
from models import npn_loader
from routes.auth_routes import router as auth_router
from routes.data_routes import router as data_router
from routes.predict_routes import router as predict_router

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up M5 Forecasting Engine...")
    try:
        init_db()
    except Exception:
        logger.exception("Database initialisation failed; API will start but data routes will error")
    try:
        npn_loader.load_metadata()
    except Exception:
        logger.exception("NPN model metadata not loaded; prediction routes will report unavailable")
    yield
    logger.info("Shutting down...")
    db.close_pool()


app = FastAPI(title="M5 Forecasting Engine", version="2.0.0", lifespan=lifespan)

# `allow_credentials=True` with a wildcard origin is rejected by every browser, so the origins
# are always explicit. Set CORS_ORIGINS to the deployed frontend URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "name": "M5 Forecasting Engine",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "model_loaded": npn_loader.is_ready()}


app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(predict_router, prefix="/api", tags=["Prediction"])
app.include_router(data_router, prefix="/api/data", tags=["Data"])
