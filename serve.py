"""Production-oriented entry point serving the SPA and API on a single port."""
from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Iterable

import uvicorn
from fastapi.responses import FileResponse, Response

from backend.app import app as backend_app


LOGGER = logging.getLogger("plantit.serve")


def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


class UnifiedApplication:
    """Minimal ASGI dispatcher that routes `/api` traffic to FastAPI and serves static assets."""

    def __init__(self, static_root: Path):
        if not static_root.exists():
            raise FileNotFoundError(f"Static frontend directory not found: {static_root}")
        index_path = static_root / "index.html"
        if not index_path.exists():
            raise FileNotFoundError("index.html is required for the unified server")

        self._backend = backend_app
        self._static_root = static_root
        self._index_path = index_path
        self._backend_paths: Iterable[str] = ("/docs", "/openapi.json", "/redoc")

    async def __call__(self, scope, receive, send):  # noqa: D401 - ASGI callable signature
        scope_type = scope.get("type")
        if scope_type == "lifespan":
            await self._backend(scope, receive, send)
            return

        if scope_type == "websocket":
            await self._backend(scope, receive, send)
            return

        if scope_type != "http":
            await self._backend(scope, receive, send)
            return

        path = scope.get("path", "/")
        if path.startswith("/api") or path in self._backend_paths:
            await self._backend(scope, receive, send)
            return

        await self._serve_static(scope, receive, send, path)

    async def _serve_static(self, scope, receive, send, path: str) -> None:
        try:
            asset_path = self._resolve_asset(path)
        except FileNotFoundError:
            response: Response = FileResponse(self._index_path)
        else:
            response = FileResponse(asset_path)

        await response(scope, receive, send)

    def _resolve_asset(self, path: str) -> Path:
        if path in {"", "/"}:
            return self._index_path

        candidate = self._static_root / path.lstrip("/")
        if candidate.is_dir():
            candidate = candidate / "index.html"

        if not candidate.exists():
            raise FileNotFoundError(path)

        return candidate


STATIC_ROOT = Path(__file__).parent / "frontend"
app = UnifiedApplication(STATIC_ROOT)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Serve Plantit SPA and API from a single port")
    parser.add_argument("--host", default="0.0.0.0", help="Interface to bind the unified server")
    parser.add_argument("--port", type=int, default=5580, help="Port to expose the unified server")
    args = parser.parse_args(argv)

    _configure_logging()
    LOGGER.info("event=serve-start host=%s port=%s", args.host, args.port)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
