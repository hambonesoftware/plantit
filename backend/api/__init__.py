"""API routers for Plantit."""

from fastapi import APIRouter

from backend.api import media, photos, search, dashboard

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(photos.router)
api_router.include_router(search.router)
api_router.include_router(dashboard.router)

app_router = APIRouter()
app_router.include_router(media.router)
