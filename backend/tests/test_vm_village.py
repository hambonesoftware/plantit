"""Tests for the village view model endpoint."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient


def _create_village_with_plant(client: TestClient) -> str:
    village = client.post(
        "/api/v1/villages/",
        json={
            "name": "Prairie Collective",
            "location": "Chicago",
            "description": "Tallgrass prairie restoration plots.",
        },
    ).json()
    client.post(
        "/api/v1/plants/",
        json={
            "name": "Switchgrass",
            "species": "Panicum virgatum",
            "tags": ["native"],
            "village_id": village["id"],
        },
    )
    return village["id"]


def test_village_vm_returns_plants(client: TestClient) -> None:
    village_id = _create_village_with_plant(client)
    response = client.get(f"/api/v1/vm/village/{village_id}")
    assert response.status_code == 200
    etag = response.headers.get("ETag")
    assert etag
    payload = response.json()
    assert payload["village"]["id"] == village_id
    assert len(payload["plants"]) == 1
    plant_payload = payload["plants"][0]
    assert plant_payload["has_photo"] is False
    assert plant_payload["thumbnail_url"] is None

    cached = client.get(
        f"/api/v1/vm/village/{village_id}", headers={"If-None-Match": etag}
    )
    assert cached.status_code == 304


def test_village_vm_handles_missing(client: TestClient) -> None:
    response = client.get(f"/api/v1/vm/village/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
