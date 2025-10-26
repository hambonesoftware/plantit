"""Run the Plantit development servers with sample data."""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import logging

import uvicorn

from backend.database import create_db_and_tables, session_scope
from backend.services.sample_data import ensure_sample_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Plantit development servers.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1).")
    parser.add_argument(
        "--backend-port",
        type=int,
        default=7700,
        help="Port for the FastAPI backend (default: 7700).",
    )
    parser.add_argument(
        "--frontend-port",
        type=int,
        default=3700,
        help="Port for the static frontend server (default: 3700).",
    )
    parser.add_argument("--reload", action="store_true", help="Enable autoreload (requires watchdog dependencies).")
    parser.add_argument(
        "--skip-sample-data",
        action="store_true",
        help="Do not insert demo garden data into the database.",
    )
    return parser.parse_args()


async def serve_backend(host: str, port: int, *, reload: bool) -> None:
    config = uvicorn.Config(
        "backend.app:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=["backend", "frontend"] if reload else None,
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


async def serve_frontend(host: str, port: int) -> None:
    from functools import partial
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    from pathlib import Path

    handler = partial(
        SimpleHTTPRequestHandler,
        directory=str(Path(__file__).resolve().parent / "frontend"),
    )
    httpd = ThreadingHTTPServer((host, port), handler)
    loop = asyncio.get_running_loop()

    try:
        await loop.run_in_executor(None, httpd.serve_forever)
    except asyncio.CancelledError:
        httpd.shutdown()
        httpd.server_close()
        raise


def prepare_sample_data(skip: bool) -> None:
    create_db_and_tables()
    if skip:
        logging.info("Skipping sample data insertion (existing data preserved).")
        return
    with session_scope() as session:
        inserted = ensure_sample_data(session)
    if inserted:
        logging.info("Loaded demo garden data into backend/data/plantit.db.")
    else:
        logging.info("Sample data already present; leaving existing records untouched.")


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    prepare_sample_data(args.skip_sample_data)
    logging.info(
        "Starting backend at http://%s:%s and frontend at http://%s:%s",
        args.host,
        args.backend_port,
        args.host,
        args.frontend_port,
    )
    if not args.reload:
        logging.info("Press CTRL+C to stop the servers.")
    try:
        asyncio.run(
            run_servers(
                args.host,
                args.backend_port,
                args.frontend_port,
                reload=args.reload,
            )
        )
    except KeyboardInterrupt:
        logging.info("Received interrupt. Shutting down...")


async def run_servers(host: str, backend_port: int, frontend_port: int, *, reload: bool) -> None:
    backend_task = asyncio.create_task(serve_backend(host, backend_port, reload=reload))
    frontend_task = asyncio.create_task(serve_frontend(host, frontend_port))

    try:
        await asyncio.gather(backend_task, frontend_task)
    except asyncio.CancelledError:
        for task in (backend_task, frontend_task):
            task.cancel()
        for task in (backend_task, frontend_task):
            with contextlib.suppress(asyncio.CancelledError):
                await task
        raise
    except Exception:
        for task in (backend_task, frontend_task):
            task.cancel()
        for task in (backend_task, frontend_task):
            with contextlib.suppress(asyncio.CancelledError):
                await task
        raise


if __name__ == "__main__":
    main()
