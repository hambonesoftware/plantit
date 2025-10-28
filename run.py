"""Application entrypoint for Plantit."""
from __future__ import annotations

import os
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.backend.db import init_db
from app.backend.routers.crud import router as crud_router
from app.backend.routers.vm import router as vm_router

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "app" / "frontend" / "static"
INDEX_FILE = ROOT / "app" / "frontend" / "index.html"

app = FastAPI(title="Plantit", docs_url="/docs", redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def on_startup() -> None:
    """Ensure the SQLite database exists before serving requests."""
    init_db()


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(INDEX_FILE)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok"})


app.include_router(vm_router, prefix="/api/vm", tags=["vm"])
app.include_router(crud_router, prefix="/api", tags=["api"])


if __name__ == "__main__":
    host = os.environ.get("APP_HOST", "127.0.0.1")
    port = int(os.environ.get("APP_PORT", "7600"))
    uvicorn.run("run:app", host=host, port=port, reload=False)
