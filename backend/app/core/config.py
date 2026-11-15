from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root .env (shared with docker-compose). Inside the container the file
# is absent and values come from real environment variables instead.
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"

# The value shipped in .env.example. Fine for local dev, refused in production.
_PLACEHOLDER_JWT_SECRET = "dev-only-secret-change-me-before-deploying-0000"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://capstone:capstone@localhost:5432/capstone"
    # Comma-separated origins, e.g. "http://localhost:5173,http://127.0.0.1:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Required: there is deliberately no default, so the app won't start
    # without JWT_SECRET being set.
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, gt=0)

    # Uploaded tender PDFs. A relative upload_dir is resolved against backend/.
    upload_dir: str = "uploads"
    max_upload_size_mb: int = Field(default=20, gt=0)

    # Condition extraction. With no key, sample conditions are used instead.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _no_placeholder_secret_in_production(self) -> "Settings":
        if self.environment == "production" and self.jwt_secret == _PLACEHOLDER_JWT_SECRET:
            raise ValueError("JWT_SECRET must be changed from the example value in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
