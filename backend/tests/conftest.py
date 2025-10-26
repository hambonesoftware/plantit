"""Test fixtures for backend."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import config, database  # noqa: E402
from backend.api import api_router, app_router  # noqa: E402


@pytest.fixture(autouse=True)
def configure_settings(tmp_path, monkeypatch) -> Iterator[None]:
    """Configure application settings for tests with temporary paths."""

    media_root = tmp_path / "media"
    db_path = tmp_path / "plantit.db"
    monkeypatch.setenv("PLANTIT_MEDIA_ROOT", str(media_root))
    monkeypatch.setenv("PLANTIT_DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("PLANTIT_MAX_UPLOAD", str(2 * 1024 * 1024))
    config.get_settings.cache_clear()
    database._engine = None
    yield
    config.get_settings.cache_clear()
    database._engine = None


@pytest.fixture()
def app() -> FastAPI:
    """Create a FastAPI app bound to the temporary database."""

    app = FastAPI()
    app.include_router(api_router)
    app.include_router(app_router)
    database.create_db_and_tables()
    return app


@pytest.fixture()
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = database.get_engine()
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
