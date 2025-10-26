"""Routes for serving the compiled frontend."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
INDEX_FILE = FRONTEND_DIR / "index.html"

router = APIRouter(tags=["frontend"])


@router.get("/", response_class=HTMLResponse, include_in_schema=False)
def serve_index() -> HTMLResponse:
    """Serve the root HTML document for the single page app."""

    if not INDEX_FILE.is_file():
        raise HTTPException(status_code=404, detail="Frontend assets not available.")
    html = INDEX_FILE.read_text(encoding="utf-8")
    return HTMLResponse(content=html)
