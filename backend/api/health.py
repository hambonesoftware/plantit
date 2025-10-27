"""Health check endpoint."""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health", summary="Health check")
def health() -> dict:
    """Return a simple heartbeat payload."""
    return {"ok": True}
