"""API router composition for Plantit."""

from fastapi import FastAPI

from . import (
    care_profiles,
    export_import,
    health,
    photos,
    plants,
    search,
    tasks,
    villages,
    vm,
)


def register_routers(app: FastAPI) -> None:
    """Register all API routers on the given FastAPI application."""
    app.include_router(health.router)
    app.include_router(villages.router)
    app.include_router(plants.router)
    app.include_router(photos.router)
    app.include_router(export_import.router)
    app.include_router(care_profiles.router)
    app.include_router(tasks.router)
    app.include_router(search.router)
    app.include_router(vm.router)


__all__ = ["register_routers"]
