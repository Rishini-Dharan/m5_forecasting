import os
import logging
from dotenv import load_dotenv
from functools import lru_cache

# encoding="utf-8-sig" strips a UTF-8 BOM. Without it, an editor-saved .env makes the first key
# parse with a leading BOM character and the real variable silently reads as empty -- which is
# how DATABASE_URL ended up defaulting to localhost.
load_dotenv(encoding="utf-8-sig")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me"


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    # Hugging Face repo holding the trained M5 models and their artifacts.
    NPN_REPO: str = os.getenv("NPN_REPO", "rishini/NPN")
    CORS_ORIGINS: list = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
        ).split(",")
        if origin.strip()
    ]
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DB_POOL_MIN: int = int(os.getenv("DB_POOL_MIN", "2"))
    DB_POOL_MAX: int = int(os.getenv("DB_POOL_MAX", "10"))

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def JWT_SECRET_KEY(self) -> str:
        """The signing key, from a single source.

        Falls back to a well-known development key so the demo runs out of the box, but says so
        loudly -- anyone who can read this repo can forge a token when the fallback is in use.
        """
        secret = os.getenv("JWT_SECRET_KEY", "")
        if not secret:
            logger.warning(
                "JWT_SECRET_KEY is not set - using the public development key. "
                "Tokens are forgeable. Set JWT_SECRET_KEY before exposing this to anyone."
            )
            return DEV_JWT_SECRET
        return secret

    def validate_required(self) -> None:
        if not self.DATABASE_URL:
            raise ValueError("Missing required environment variable: DATABASE_URL")


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    if settings.is_production:
        settings.validate_required()
    return settings


settings = get_settings()
logger.setLevel(settings.LOG_LEVEL)
