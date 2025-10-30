from __future__ import annotations

import argparse
import json
import logging
import signal
import sys
import threading
from contextlib import suppress
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import NoReturn

import uvicorn

from backend.app import app as backend_app

STATIC_PORT = 5580
API_PORT = 5581


class JsonMessageFormatter(logging.Formatter):
    """Formatter that renders log records as JSON strings."""

    default_time_format = "%Y-%m-%d %H:%M:%S"

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401 - short description inherited
        record_dict = {
            "timestamp": self.formatTime(record, self.default_time_format),
            "level": record.levelname,
            "name": record.name,
            "message": record.getMessage(),
        }
        return json.dumps(record_dict, ensure_ascii=False, separators=(",", ":"))


class AccessJsonFormatter(JsonMessageFormatter):
    """Formatter that captures HTTP access metadata when available."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        payload = {
            "timestamp": self.formatTime(record, self.default_time_format),
            "level": record.levelname,
            "name": "uvicorn.access",
        }
        client = getattr(record, "client_addr", None)
        method = getattr(record, "request_method", None)
        path = getattr(record, "request_path", None)
        status = getattr(record, "status_code", None)

        if client is not None:
            payload["client"] = client
        if method is not None:
            payload["method"] = method
        if path is not None:
            payload["path"] = path
        if status is not None:
            payload["status"] = status

        payload["message"] = record.getMessage()
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging() -> None:
    """Configure JSON logging for Plantit development services."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonMessageFormatter())

    access_handler = logging.StreamHandler()
    access_handler.setFormatter(AccessJsonFormatter())

    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(logging.INFO)

    for name in ("plantit", "uvicorn", "uvicorn.error"):
        logger = logging.getLogger(name)
        logger.handlers = [handler]
        logger.setLevel(logging.INFO)
        logger.propagate = False

    access_logger = logging.getLogger("uvicorn.access")
    access_logger.handlers = [access_handler]
    access_logger.setLevel(logging.INFO)
    access_logger.propagate = False


configure_logging()
LOGGER = logging.getLogger("plantit.dev")


def _serve_static(stop_event: threading.Event) -> None:
    directory = Path(__file__).parent / "frontend"
    if not directory.exists():
        raise FileNotFoundError("frontend directory is required")

    handler_class = partial(SimpleHTTPRequestHandler, directory=str(directory))

    with ThreadingHTTPServer(("0.0.0.0", STATIC_PORT), handler_class) as httpd:
        httpd.timeout = 0.5
        LOGGER.info(
            "event=static-server-start port=%s directory=%s", STATIC_PORT, directory
        )
        while not stop_event.is_set():
            httpd.handle_request()
    LOGGER.info("event=static-server-stop")


def _serve_api(stop_event: threading.Event) -> None:
    config = uvicorn.Config(
        backend_app,
        host="0.0.0.0",
        port=API_PORT,
        log_config=None,
        log_level="info",
        access_log=True,
    )
    server = uvicorn.Server(config)

    def watch_for_stop() -> None:
        stop_event.wait()
        server.should_exit = True

    watcher = threading.Thread(target=watch_for_stop, name="uvicorn-stop", daemon=True)
    watcher.start()
    LOGGER.info("event=api-server-start port=%s", API_PORT)
    server.run()
    LOGGER.info("event=api-server-stop")


def main(argv: list[str] | None = None) -> NoReturn:
    parser = argparse.ArgumentParser(description="Run Plantit dev servers")
    parser.parse_args(argv)

    stop_event = threading.Event()

    threads = [
        threading.Thread(target=_serve_static, name="static-server", args=(stop_event,), daemon=True),
        threading.Thread(target=_serve_api, name="api-server", args=(stop_event,), daemon=True),
    ]

    LOGGER.info("event=orchestrator-start static_port=%s api_port=%s", STATIC_PORT, API_PORT)

    for thread in threads:
        thread.start()

    def handle_signal(signum, _frame) -> None:
        LOGGER.info("event=signal-received signum=%s", signum)
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        with suppress(ValueError, AttributeError):
            signal.signal(sig, handle_signal)

    try:
        while any(thread.is_alive() for thread in threads):
            for thread in threads:
                thread.join(timeout=0.5)
    except KeyboardInterrupt:
        LOGGER.info("event=keyboard-interrupt")
        stop_event.set()
    finally:
        LOGGER.info("event=orchestrator-stop")
        sys.exit(0)


if __name__ == "__main__":
    main()
