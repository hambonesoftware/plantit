"""API routers for Plantit."""

from fastapi import APIRouter

from backend.api import dashboard, media, photos, plants, search, tasks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(photos.router)
api_router.include_router(plants.router)
api_router.include_router(tasks.router)
api_router.include_router(search.router)
api_router.include_router(dashboard.router)

app_router = APIRouter()
app_router.include_router(media.router)
