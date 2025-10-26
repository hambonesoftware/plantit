"""Integration smoke test for OpenAPI availability."""

from __future__ import annotations

import os

import httpx
import pytest

pytestmark = pytest.mark.skipif(
    os.getenv("PLANTIT_RUN_OPENAPI_TEST") != "1",
    reason="PLANTIT_RUN_OPENAPI_TEST not set; skipping OpenAPI integration test.",
)


def test_openapi_available() -> None:
    """Ensure the FastAPI OpenAPI schema is reachable."""

    response = httpx.get("http://localhost:8000/openapi.json", timeout=5.0)
    response.raise_for_status()
    data = response.json()
    assert "components" in data and "schemas" in data["components"]
    assert "DashboardResponse" in data["components"]["schemas"], "DashboardResponse schema missing"
