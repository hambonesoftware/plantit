"""API router composition for Plantit."""
from fastapi import FastAPI

from . import health, plants, villages, vm


def register_routers(app: FastAPI) -> None:
    """Register all API routers on the given FastAPI application."""
    app.include_router(health.router)
    app.include_router(villages.router)
    app.include_router(plants.router)
    app.include_router(vm.router)


__all__ = ["register_routers"]
