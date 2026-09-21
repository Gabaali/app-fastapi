from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_publishable_key: str
    supabase_secret_key: str

    frontend_origin: str = "http://localhost:3000"

    card_media_base_url: str

    card_db_dir: Path = Path("./data")

    default_booster_price_coins: int = 599

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def supabase_issuer(self) -> str:
        return (
            f"{self.supabase_url.rstrip('/')}"
            "/auth/v1"
        )

    @property
    def supabase_jwks_url(self) -> str:
        return (
            f"{self.supabase_issuer}"
            "/.well-known/jwks.json"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()