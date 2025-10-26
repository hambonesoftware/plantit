"""Static media serving endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.config import get_settings

router = APIRouter(tags=["media"])


@router.get("/media/{requested_path:path}")
def get_media(requested_path: str) -> FileResponse:
    """Serve media files from the configured media root."""

    settings = get_settings()
    base = settings.media_root.resolve()
    target = (settings.media_root / requested_path).resolve()
    if base not in target.parents and target != base:
        raise HTTPException(status_code=404, detail="File not found.")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(target)
