from __future__ import annotations

import argparse
import signal
import sys
import threading
from contextlib import suppress
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import NoReturn

import uvicorn
from fastapi import FastAPI

STATIC_PORT = 5580
API_PORT = 5581

app = FastAPI()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _serve_static(stop_event: threading.Event) -> None:
    directory = Path(__file__).parent / "frontend"
    if not directory.exists():
        raise FileNotFoundError("frontend directory is required")

    handler_class = partial(SimpleHTTPRequestHandler, directory=str(directory))

    with ThreadingHTTPServer(("0.0.0.0", STATIC_PORT), handler_class) as httpd:
        httpd.timeout = 0.5
        print(f"[static] Serving {directory} on http://127.0.0.1:{STATIC_PORT}")
        while not stop_event.is_set():
            httpd.handle_request()


def _serve_api(stop_event: threading.Event) -> None:
    config = uvicorn.Config(app, host="0.0.0.0", port=API_PORT, log_level="info")
    server = uvicorn.Server(config)

    def watch_for_stop() -> None:
        stop_event.wait()
        server.should_exit = True

    watcher = threading.Thread(target=watch_for_stop, name="uvicorn-stop", daemon=True)
    watcher.start()
    print(f"[api] FastAPI listening on http://127.0.0.1:{API_PORT}")
    server.run()


def main(argv: list[str] | None = None) -> NoReturn:
    parser = argparse.ArgumentParser(description="Run Plantit dev servers")
    parser.parse_args(argv)

    stop_event = threading.Event()

    threads = [
        threading.Thread(target=_serve_static, name="static-server", args=(stop_event,), daemon=True),
        threading.Thread(target=_serve_api, name="api-server", args=(stop_event,), daemon=True),
    ]

    print("=== Plantit Dev Orchestrator ===")
    print("Static: http://127.0.0.1:5580/ (add ?safe=1 for safe boot)")
    print("API:    http://127.0.0.1:5581/health")
    print("Press Ctrl+C to stop both servers.\n")

    for thread in threads:
        thread.start()

    def handle_signal(signum, _frame) -> None:
        print(f"\nReceived signal {signum}, shutting down...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        with suppress(ValueError, AttributeError):
            signal.signal(sig, handle_signal)

    try:
        while any(thread.is_alive() for thread in threads):
            for thread in threads:
                thread.join(timeout=0.5)
    except KeyboardInterrupt:
        print("\nKeyboard interrupt received, exiting...")
        stop_event.set()
    finally:
        print("Servers stopped. Bye!")
        sys.exit(0)


if __name__ == "__main__":
    main()
