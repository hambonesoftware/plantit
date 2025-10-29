"""Application entrypoint for Plantit."""
from __future__ import annotations

import asyncio
import logging
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

logger = logging.getLogger("plantit.runtime")
if not logger.handlers:
    logging.basicConfig(
        level=logging.DEBUG,
        format="[%(asctime)s] [%(levelname)s] %(name)s: %(message)s",
    )
    logger.debug("Configured default logging for Plantit runtime.")


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "app" / "frontend" / "static"
INDEX_FILE = ROOT / "app" / "frontend" / "index.html"
STATIC_MANIFEST: Dict[str, str] = {}


def build_static_manifest() -> Dict[str, str]:
    logger.debug("Starting static manifest build.")
    manifest: Dict[str, str] = {}
    all_paths = [INDEX_FILE, *STATIC_DIR.rglob("*")]
    logger.debug("Discovered %d potential static paths for hashing.", len(all_paths))
    for path in all_paths:
        if not path.is_file():
            logger.debug("Skipping non-file path during manifest build: %s", path)
            continue
        rel_path = path.relative_to(ROOT)
        logger.debug("Hashing static asset: %s", rel_path)
        digest = sha256(path.read_bytes()).hexdigest()
        manifest[str(rel_path)] = digest
        logger.debug("Recorded digest for %s: %s", rel_path, digest)
    logger.debug("Completed static manifest build with %d entries.", len(manifest))
    return manifest

class CacheControlMiddleware(BaseHTTPMiddleware):
    """Apply cache headers to static assets while keeping HTML non-cacheable."""

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        logger.debug("CacheControlMiddleware processing path: %s", request.url.path)
        response = await call_next(request)
        path = request.url.path
        if path.startswith("/static/"):
            response.headers.setdefault(
                "Cache-Control", "public, max-age=31536000, immutable"
            )
            logger.debug("Applied static cache headers for %s", path)
        elif path == "/":
            response.headers.setdefault("Cache-Control", "no-cache")
            logger.debug("Applied no-cache headers for %s", path)
        return response


logger.debug("Loading environment variables from .env (if present).")
dotenv_loaded = load_dotenv()
logger.debug("Environment load complete. Dotenv file discovered: %s", dotenv_loaded)


def _backend_origin() -> str:
    backend_host = os.environ.get("BACKEND_HOST", os.environ.get("APP_HOST", "127.0.0.1"))
    backend_port = os.environ.get("BACKEND_PORT", "5591")
    logger.debug(
        "Resolved backend host and port: host=%s, port=%s (APP_HOST=%s)",
        backend_host,
        backend_port,
        os.environ.get("APP_HOST"),
    )

    # ``0.0.0.0`` (or ``::``) is a special "all interfaces" address that is valid for
    # binding servers but not for making HTTP client requests.  When we launch the
    # app with ``APP_HOST=0.0.0.0`` to expose it externally (e.g., for Playwright),
    # the proxy client would previously attempt to reach ``http://0.0.0.0:5591``.  In
    # sandboxed environments this is rejected with ``403 Domain forbidden`` by the
    # networking layer, which surfaced in the browser console as repeated
    # ``/api/vm/dashboard`` 403 errors.  Map wildcard hosts back to loopback so the
    # proxy can always reach the backend.
    if backend_host in {"0.0.0.0", "::"}:
        backend_host = "127.0.0.1"
        logger.debug("Normalized wildcard backend host to loopback.")

    origin = os.environ.get("BACKEND_ORIGIN", f"http://{backend_host}:{backend_port}")
    logger.debug("Computed backend origin: %s", origin)
    return origin


def create_frontend_app() -> FastAPI:
    """Build the ASGI application that serves the static frontend."""

    logger.debug("Creating frontend FastAPI application instance.")
    app = FastAPI(title="Plantit Frontend", docs_url=None, redoc_url=None)
    app.add_middleware(CacheControlMiddleware)
    logger.debug("Attached CacheControlMiddleware to frontend app.")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    logger.debug("Mounted static directory at /static: %s", STATIC_DIR)

    backend_origin = _backend_origin()
    logger.debug("Frontend proxy will target backend origin: %s", backend_origin)

    @app.on_event("startup")
    async def startup() -> None:
        logger.debug("Frontend startup: creating AsyncClient for proxying.")
        app.state.proxy_client = httpx.AsyncClient(base_url=backend_origin, timeout=None)
        logger.debug("Frontend startup: AsyncClient ready.")

    @app.on_event("shutdown")
    async def shutdown() -> None:
        client = getattr(app.state, "proxy_client", None)
        if client is not None:
            logger.debug("Frontend shutdown: closing AsyncClient.")
            await client.aclose()
            logger.debug("Frontend shutdown: AsyncClient closed.")

    @app.get("/")
    async def index() -> FileResponse:
        logger.debug("Serving frontend index.html to client.")
        return FileResponse(INDEX_FILE)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    async def proxy_api(request: Request, path: str) -> Response:
        logger.debug("Proxying API request: %s %s", request.method, path)
        client: httpx.AsyncClient = app.state.proxy_client
        url = f"/api/{path}"
        headers = {
            key: value
            for key, value in request.headers.items()
            if key.lower() not in {"host", "content-length", "connection"}
        }
        logger.debug("Proxy headers prepared: %s", headers)
        try:
            upstream_request = client.build_request(
                request.method,
                url,
                headers=headers,
                content=await request.body(),
                params=request.query_params,
            )
            logger.debug("Sending upstream request to %s", url)
            upstream_response = await client.send(upstream_request)
            logger.debug(
                "Received upstream response: status=%s headers=%s",
                upstream_response.status_code,
                dict(upstream_response.headers),
            )
        except httpx.RequestError as exc:
            logger.exception("Upstream request failed: %s", exc)
            raise HTTPException(status_code=502, detail=f"Upstream request failed: {exc}")

        excluded_headers = {"content-length", "connection", "transfer-encoding"}
        response_headers = {
            key: value
            for key, value in upstream_response.headers.items()
            if key.lower() not in excluded_headers
        }
        logger.debug("Filtered response headers for client: %s", response_headers)

        return Response(
            content=upstream_response.content,
            status_code=upstream_response.status_code,
            headers=response_headers,
            media_type=upstream_response.headers.get("content-type"),
        )

    return app


def create_backend_app() -> FastAPI:
    """Build the ASGI application that exposes the API surface."""

    logger.debug("Creating backend FastAPI application instance.")
    app = FastAPI(title="Plantit Backend", docs_url="/docs", redoc_url=None)

    @app.on_event("startup")
    def on_startup() -> None:
        """Ensure the SQLite database exists before serving requests."""
        logger.debug("Backend startup: initializing database.")
        init_db()
        logger.debug("Backend startup: database initialization complete.")
        global STATIC_MANIFEST
        logger.debug("Backend startup: building static manifest cache.")
        STATIC_MANIFEST = build_static_manifest()
        logger.debug("Backend startup: static manifest cached with %d entries.", len(STATIC_MANIFEST))

    @app.get("/health")
    async def health() -> JSONResponse:
        logger.debug("Health check endpoint requested.")
        return JSONResponse({"status": "ok", "static": STATIC_MANIFEST})

    app.include_router(vm_router, prefix="/api/vm", tags=["vm"])
    logger.debug("Backend router mounted at /api/vm")
    app.include_router(crud_router, prefix="/api", tags=["api"])
    logger.debug("Backend router mounted at /api")

    return app


frontend_app = create_frontend_app()
backend_app = create_backend_app()

# Backwards compatibility for tests/tools that import ``run:app``.
app = backend_app


async def _serve() -> None:
    """Launch both the frontend and backend servers concurrently."""

    logger.debug("Preparing to launch frontend and backend servers.")
    frontend_host = os.environ.get("FRONTEND_HOST", os.environ.get("APP_HOST", "127.0.0.1"))
    backend_host = os.environ.get("BACKEND_HOST", os.environ.get("APP_HOST", "127.0.0.1"))
    frontend_port = int(os.environ.get("FRONTEND_PORT", "5590"))
    backend_port = int(os.environ.get("BACKEND_PORT", "5591"))
    logger.debug(
        "Server binding configuration: frontend=%s:%s backend=%s:%s",
        frontend_host,
        frontend_port,
        backend_host,
        backend_port,
    )

    frontend_config = uvicorn.Config(frontend_app, host=frontend_host, port=frontend_port, log_level="info")
    backend_config = uvicorn.Config(backend_app, host=backend_host, port=backend_port, log_level="info")
    logger.debug("Uvicorn configurations created for frontend and backend servers.")

    frontend_server = uvicorn.Server(frontend_config)
    backend_server = uvicorn.Server(backend_config)
    logger.debug("Uvicorn server instances instantiated.")

    # ``uvicorn.Server`` installs signal handlers on ``serve``; we manage them manually.
    frontend_server.install_signal_handlers = lambda: None  # type: ignore[assignment]
    backend_server.install_signal_handlers = lambda: None  # type: ignore[assignment]
    logger.debug("Disabled automatic signal handlers for uvicorn servers.")

    loop = asyncio.get_running_loop()
    logger.debug("Retrieved running event loop: %s", loop)

    def _request_shutdown() -> None:
        logger.debug("Shutdown signal received; requesting uvicorn servers to exit.")
        frontend_server.should_exit = True
        backend_server.should_exit = True

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _request_shutdown)
            logger.debug("Registered signal handler for %s on event loop.", sig)
        except NotImplementedError:
            # Fallback for event loops that do not support signal handlers
            signal.signal(sig, lambda *_: _request_shutdown())
            logger.debug("Fallback signal handler registered for %s via signal.signal.", sig)

    logger.debug("Starting uvicorn servers concurrently.")
    await asyncio.gather(frontend_server.serve(), backend_server.serve())
    logger.debug("Uvicorn servers have exited. Shutdown complete.")


def main() -> None:
    try:
        logger.debug("Entering main(); launching async server runner.")
        asyncio.run(_serve())
    except KeyboardInterrupt:
        # ``asyncio.run`` translates SIGINT into a KeyboardInterrupt if it fires
        # while the event loop is being created; ignore to allow a clean exit.
        logger.debug("KeyboardInterrupt received during startup; ignoring for clean exit.")
        pass


if __name__ == "__main__":
    main()
