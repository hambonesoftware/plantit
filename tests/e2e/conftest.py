from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest


SERVER_STARTUP_TIMEOUT = 60


def _wait_for_endpoint(url: str, *, timeout: int = SERVER_STARTUP_TIMEOUT) -> None:
    deadline = time.time() + timeout
    last_error: Exception | None = None

    while time.time() < deadline:
        try:
            response = httpx.get(url, timeout=1.0)
            if response.status_code < 500:
                return
        except Exception as exc:  # pragma: no cover - best-effort polling
            last_error = exc
        time.sleep(0.2)

    raise RuntimeError(f"Timed out waiting for {url!r}") from last_error


@pytest.fixture(scope="session")
def e2e_artifacts_dir() -> Path:
    path = Path(__file__).resolve().parents[2] / "artifacts" / "e2e"
    path.mkdir(parents=True, exist_ok=True)
    return path


@pytest.fixture(scope="session")
def plantit_server(e2e_artifacts_dir: Path):
    repo_root = Path(__file__).resolve().parents[2]
    env = os.environ.copy()
    env.setdefault("PYTHONUNBUFFERED", "1")
    env.setdefault("PLANTIT_AUTH_ENABLED", "0")

    log_path = e2e_artifacts_dir / "dev-server.log"
    with log_path.open("w", encoding="utf-8") as log_file:
        process = subprocess.Popen(
            [sys.executable, "run.py"],
            cwd=repo_root,
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
        )

        try:
            _wait_for_endpoint("http://127.0.0.1:5580/")
            _wait_for_endpoint("http://127.0.0.1:5581/api/health")
            yield {
                "app": "http://127.0.0.1:5580",
                "api": "http://127.0.0.1:5581",
                "log": log_path,
            }
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGINT)
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)


@pytest.fixture(scope="session")
def plantit_base_url(plantit_server) -> str:
    return plantit_server["app"]


@pytest.fixture(scope="session")
def plantit_api_url(plantit_server) -> str:
    return plantit_server["api"]
