"""FastAPI application entrypoint."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.api import api_router, app_router
from backend.database import create_db_and_tables


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""

    create_db_and_tables()
    app = FastAPI(title="Plantit API", version="0.1.0")
    app.include_router(api_router)
    app.include_router(app_router)
    _mount_frontend(app)
    return app


def _mount_frontend(app: FastAPI) -> None:
    """Mount static frontend assets if they exist."""

    frontend_dir = Path(__file__).resolve().parents[1] / "frontend"
    static_mappings = {
        "/assets": frontend_dir / "assets",
        "/styles": frontend_dir / "styles",
        "/js": frontend_dir / "js",
        "/types": frontend_dir / "types",
    }
    for mount_point, directory in static_mappings.items():
        if directory.is_dir():
            app.mount(mount_point, StaticFiles(directory=directory), name=mount_point.strip("/"))


app = create_app()
