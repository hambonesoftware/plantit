"""Application settings."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the backend."""

    debug: bool = Field(default=False, alias="PLANTIT_DEBUG")
    database_url: str = Field(
        default="sqlite:///backend/data/plantit.db", alias="PLANTIT_DATABASE_URL"
    )
    media_root: Path = Field(
        default=Path("backend/data/media"), alias="PLANTIT_MEDIA_ROOT"
    )
    max_upload_size: int = Field(default=12 * 1024 * 1024, alias="PLANTIT_MAX_UPLOAD")

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache(maxsize=1)
def get_settings(**overrides: Any) -> Settings:
    """Return cached application settings."""

    if overrides:
        return Settings(**overrides)
    return Settings()
