"""Run the Plantit development server with sample data."""

from __future__ import annotations

import argparse
import asyncio
import logging

import uvicorn

from backend.database import create_db_and_tables, session_scope
from backend.services.sample_data import ensure_sample_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Plantit development server.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind (default: 127.0.0.1).")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind (default: 8000).")
    parser.add_argument("--reload", action="store_true", help="Enable autoreload (requires watchdog dependencies).")
    parser.add_argument(
        "--skip-sample-data",
        action="store_true",
        help="Do not insert demo garden data into the database.",
    )
    return parser.parse_args()


async def serve(host: str, port: int, *, reload: bool) -> None:
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
    logging.info("Starting Plantit at http://%s:%s", args.host, args.port)
    if not args.reload:
        logging.info("Press CTRL+C to stop the server.")
    try:
        asyncio.run(serve(args.host, args.port, reload=args.reload))
    except KeyboardInterrupt:
        logging.info("Received interrupt. Shutting down...")


if __name__ == "__main__":
    main()
