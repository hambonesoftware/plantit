"""Application entrypoint for Plantit."""
from __future__ import annotations

import asyncio
import os
import signal
from hashlib import sha256
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv

import uvicorn
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

import httpx

from app.backend.db import init_db
from app.backend.routers.crud import router as crud_router
from app.backend.routers.vm import router as vm_router

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "app" / "frontend" / "static"
INDEX_FILE = ROOT / "app" / "frontend" / "index.html"
STATIC_MANIFEST: Dict[str, str] = {}


def build_static_manifest() -> Dict[str, str]:
    manifest: Dict[str, str] = {}
    for path in [INDEX_FILE, *STATIC_DIR.rglob("*")]:
        if not path.is_file():
            continue
        rel_path = path.relative_to(ROOT)
        digest = sha256(path.read_bytes()).hexdigest()
        manifest[str(rel_path)] = digest
    return manifest

class CacheControlMiddleware(BaseHTTPMiddleware):
    """Apply cache headers to static assets while keeping HTML non-cacheable."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/static/"):
            response.headers.setdefault(
                "Cache-Control", "public, max-age=31536000, immutable"
            )
        elif path == "/":
            response.headers.setdefault("Cache-Control", "no-cache")
        return response


load_dotenv()


def _backend_origin() -> str:
    backend_host = os.environ.get("BACKEND_HOST", os.environ.get("APP_HOST", "127.0.0.1"))
    backend_port = os.environ.get("BACKEND_PORT", "5591")
    return os.environ.get("BACKEND_ORIGIN", f"http://{backend_host}:{backend_port}")


def create_frontend_app() -> FastAPI:
    """Build the ASGI application that serves the static frontend."""

    app = FastAPI(title="Plantit Frontend", docs_url=None, redoc_url=None)
    app.add_middleware(CacheControlMiddleware)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    backend_origin = _backend_origin()

    @app.on_event("startup")
    async def startup() -> None:
        app.state.proxy_client = httpx.AsyncClient(base_url=backend_origin, timeout=None)

    @app.on_event("shutdown")
    async def shutdown() -> None:
        client = getattr(app.state, "proxy_client", None)
        if client is not None:
            await client.aclose()

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(INDEX_FILE)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    async def proxy_api(request: Request, path: str) -> Response:
        client: httpx.AsyncClient = app.state.proxy_client
        url = f"/api/{path}"
        headers = {
            key: value
            for key, value in request.headers.items()
            if key.lower() not in {"host", "content-length", "connection"}
        }
        try:
            upstream_request = client.build_request(
                request.method,
                url,
                headers=headers,
                content=await request.body(),
                params=request.query_params,
            )
            upstream_response = await client.send(upstream_request)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Upstream request failed: {exc}")

        excluded_headers = {"content-length", "connection", "transfer-encoding"}
        response_headers = {
            key: value
            for key, value in upstream_response.headers.items()
            if key.lower() not in excluded_headers
        }

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=response_headers,
            media_type=upstream_response.headers.get("content-type"),
        )

    return app


def create_backend_app() -> FastAPI:
    """Build the ASGI application that exposes the API surface."""

    app = FastAPI(title="Plantit Backend", docs_url="/docs", redoc_url=None)

    @app.on_event("startup")
    def on_startup() -> None:
        """Ensure the SQLite database exists before serving requests."""
        init_db()
        global STATIC_MANIFEST
        STATIC_MANIFEST = build_static_manifest()

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok", "static": STATIC_MANIFEST})

    app.include_router(vm_router, prefix="/api/vm", tags=["vm"])
    app.include_router(crud_router, prefix="/api", tags=["api"])

    return app


frontend_app = create_frontend_app()
backend_app = create_backend_app()

# Backwards compatibility for tests/tools that import ``run:app``.
app = backend_app


async def _serve() -> None:
    """Launch both the frontend and backend servers concurrently."""

    frontend_host = os.environ.get("FRONTEND_HOST", os.environ.get("APP_HOST", "127.0.0.1"))
    backend_host = os.environ.get("BACKEND_HOST", os.environ.get("APP_HOST", "127.0.0.1"))
    frontend_port = int(os.environ.get("FRONTEND_PORT", "5590"))
    backend_port = int(os.environ.get("BACKEND_PORT", "5591"))

    frontend_config = uvicorn.Config(frontend_app, host=frontend_host, port=frontend_port, log_level="info")
    backend_config = uvicorn.Config(backend_app, host=backend_host, port=backend_port, log_level="info")

    frontend_server = uvicorn.Server(frontend_config)
    backend_server = uvicorn.Server(backend_config)

    # ``uvicorn.Server`` installs signal handlers on ``serve``; we manage them manually.
    frontend_server.install_signal_handlers = lambda: None  # type: ignore[assignment]
    backend_server.install_signal_handlers = lambda: None  # type: ignore[assignment]

    loop = asyncio.get_running_loop()

    def _request_shutdown() -> None:
        frontend_server.should_exit = True
        backend_server.should_exit = True

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_shutdown)
        except NotImplementedError:
            # Fallback for event loops that do not support signal handlers
            signal.signal(sig, lambda *_: _request_shutdown())

    await asyncio.gather(frontend_server.serve(), backend_server.serve())


def main() -> None:
    try:
        asyncio.run(_serve())
    except KeyboardInterrupt:
        # ``asyncio.run`` translates SIGINT into a KeyboardInterrupt if it fires
        # while the event loop is being created; ignore to allow a clean exit.
        pass


if __name__ == "__main__":
    main()
