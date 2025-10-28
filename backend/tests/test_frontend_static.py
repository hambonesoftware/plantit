"""Tests for serving frontend assets via FastAPI."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_root_serves_index_html(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"].lower()
    assert "<title>Plantit" in response.text


def test_static_asset_served(client: TestClient) -> None:
    response = client.get("/js/router.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"].lower()
    assert "renderHomeView" in response.text
