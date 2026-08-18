import os
import logging
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    MODEL_PATH: str = os.getenv("MODEL_PATH", "models/lgb_model.txt")
    HF_MODEL_REPO: str = os.getenv("HF_MODEL_REPO", "rishini/NPN-hybrid")
    HF_MODEL_FILENAME: str = os.getenv("HF_MODEL_FILENAME", "model.txt")
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DB_POOL_MIN: int = int(os.getenv("DB_POOL_MIN", "2"))
    DB_POOL_MAX: int = int(os.getenv("DB_POOL_MAX", "10"))
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    def validate_required(self) -> None:
        required = ["DATABASE_URL", "JWT_SECRET_KEY"]
        missing = [key for key in required if not getattr(self, key)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production:
        settings.validate_required()
    return settings

settings = get_settings()
logger.setLevel(settings.LOG_LEVEL)