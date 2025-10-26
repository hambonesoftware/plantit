"""FastAPI application entrypoint."""

from __future__ import annotations

from fastapi import FastAPI

from backend.api import api_router, app_router
from backend.database import create_db_and_tables


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    create_db_and_tables()
    app = FastAPI(title="Plantit API", version="0.1.0")
    app.include_router(api_router)
    app.include_router(app_router)
    return app


app = create_app()
