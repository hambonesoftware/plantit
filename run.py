"""FastAPI entrypoint for Phase 0 safe-boot server."""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
import uvicorn

ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT / "frontend"
STATIC_DIR = ROOT / "static"

app = FastAPI(title="PlantIT Safe Boot")


def _read_text_file(path: Path, *, media_type: str) -> Response:
    if not path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path.name}")
    data = path.read_text(encoding="utf-8")
    return Response(content=data, media_type=media_type)


@app.get("/", response_class=HTMLResponse)
async def serve_index(_: Request) -> HTMLResponse:
    """Serve the main HTML document."""
    return HTMLResponse((FRONTEND_DIR / "index.html").read_text(encoding="utf-8"))


@app.get("/app.js")
async def serve_app_js(_: Request) -> Response:
    """Serve the boot JavaScript module."""
    return _read_text_file(FRONTEND_DIR / "app.js", media_type="text/javascript")


@app.get("/api/health")
async def api_health() -> Dict[str, Any]:
    """Simple health endpoint used by smoke tests."""
    return {"ok": True}


@app.post("/api/echo")
async def api_echo(payload: Dict[str, Any] = Body(default_factory=dict)) -> JSONResponse:
    """Echo back the payload provided by the caller."""
    return JSONResponse({"ok": True, "echo": payload})


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_fallback(full_path: str) -> HTMLResponse:
    """Return index.html for any non-API route to support SPA navigation."""
    if full_path.startswith("api/") or full_path == "app.js" or full_path.startswith("static/"):
        raise HTTPException(status_code=404, detail="Not found")
    return HTMLResponse((FRONTEND_DIR / "index.html").read_text(encoding="utf-8"))


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def run() -> None:
    """Run the application using uvicorn."""
    uvicorn.run("run:app", host="0.0.0.0", port=5590, reload=False)


if __name__ == "__main__":
    run()
