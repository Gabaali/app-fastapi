from functools import lru_cache

from supabase import Client, create_client

from .config import get_settings


@lru_cache
def get_supabase_admin() -> Client:
    settings = get_settings()

    # Clé SECRET : uniquement dans FastAPI.
    return create_client(
        settings.supabase_url,
        settings.supabase_secret_key,
    )
