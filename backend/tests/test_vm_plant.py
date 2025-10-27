"""Tests for the plant view model endpoint."""
from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient


def _create_plant(client: TestClient) -> str:
    village = client.post(
        "/api/v1/villages/",
        json={
            "name": "Mesa Farmers",
            "location": "Phoenix",
            "description": "Desert agriculture research.",
        },
    ).json()
    plant = client.post(
        "/api/v1/plants/",
        json={
            "name": "Agave",
            "species": "Agave americana",
            "village_id": village["id"],
        },
    ).json()
    return plant["id"]


def test_plant_vm_response(client: TestClient) -> None:
    plant_id = _create_plant(client)
    response = client.get(f"/api/v1/vm/plant/{plant_id}")
    assert response.status_code == 200
    etag = response.headers.get("ETag")
    assert etag
    payload = response.json()
    assert payload["plant"]["id"] == plant_id

    cached = client.get(f"/api/v1/vm/plant/{plant_id}", headers={"If-None-Match": etag})
    assert cached.status_code == 304


def test_plant_vm_missing(client: TestClient) -> None:
    response = client.get(f"/api/v1/vm/plant/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
