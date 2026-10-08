from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_API_ROOT = Path(__file__).resolve().parents[1]
_REPO_ROOT = _API_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_REPO_ROOT / ".env"), str(_API_ROOT / ".env")),
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://learning_lab:learning_lab@localhost:5434/learning_lab"
    session_cookie_name: str = "learning_lab_session"
    session_ttl_days: int = 14
    password_bcrypt_rounds: int = 12
    cors_origins: str = "http://localhost:3000"

    seed_admin_email: str = "admin@learninglab.test"
    seed_admin_password: str = "learning-lab-dev"
    seed_admin_name: str = "School admin"
    seed_org_name: str = "Learning Lab"
    seed_org_slug: str = "learning-lab"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
