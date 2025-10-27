"""Tests for the home view model endpoint."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_home_vm_counts(client: TestClient) -> None:
    client.post(
        "/api/v1/villages/",
        json={
            "name": "Highland Farms",
            "location": "Boulder",
            "description": "Rooftop gardens across the city.",
        },
    )
    village = client.post(
        "/api/v1/villages/",
        json={
            "name": "Forest Edge",
            "location": "Seattle",
            "description": "Agroforestry experimentation plots.",
        },
    ).json()
    client.post(
        "/api/v1/plants/",
        json={
            "name": "Fern",
            "species": "Pteridophyta",
            "notes": "Loves shade",
            "tags": ["shade"],
            "village_id": village["id"],
        },
    )

    response = client.get("/api/v1/vm/home")
    assert response.status_code == 200
    etag = response.headers.get("ETag")
    assert etag
    payload = response.json()
    assert payload["villages"]["total"] == 2
    assert payload["plants"]["total"] == 1

    cached_response = client.get("/api/v1/vm/home", headers={"If-None-Match": etag})
    assert cached_response.status_code == 304
