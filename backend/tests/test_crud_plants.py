"""CRUD tests for plant endpoints."""
from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient


def _create_village(client: TestClient) -> str:
    response = client.post(
        "/api/v1/villages/",
        json={
            "name": "Coastal Growers",
            "location": "San Diego",
            "description": "Hydroponic experimental plots.",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_plant_crud_flow(client: TestClient) -> None:
    village_id = _create_village(client)

    plant_payload = {
        "name": "Blueberry",
        "species": "Vaccinium",
        "notes": "Requires acidic soil and frequent watering.",
        "tags": ["berry", "perennial"],
        "village_id": village_id,
    }
    create_response = client.post("/api/v1/plants/", json=plant_payload)
    assert create_response.status_code == 201
    plant_id = create_response.json()["id"]

    list_response = client.get("/api/v1/plants/", params={"village_id": village_id})
    assert list_response.status_code == 200
    list_etag = list_response.headers.get("ETag")
    assert list_etag
    assert list_response.json()[0]["name"] == "Blueberry"
    not_modified = client.get(
        "/api/v1/plants/",
        params={"village_id": village_id},
        headers={"If-None-Match": list_etag},
    )
    assert not_modified.status_code == 304

    detail_response = client.get(f"/api/v1/plants/{plant_id}")
    assert detail_response.status_code == 200
    detail_etag = detail_response.headers.get("ETag")
    assert detail_etag

    update_response = client.patch(
        f"/api/v1/plants/{plant_id}",
        json={"notes": "Mulch added", "tags": ["berry", "mulched"]},
    )
    assert update_response.status_code == 200
    assert update_response.json()["tags"] == ["berry", "mulched"]

    refreshed_detail = client.get(f"/api/v1/plants/{plant_id}")
    assert refreshed_detail.status_code == 200
    assert refreshed_detail.headers.get("ETag") != detail_etag

    delete_response = client.delete(f"/api/v1/plants/{plant_id}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/v1/plants/{plant_id}")
    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "NOT_FOUND"


def test_plant_rejects_invalid_village(client: TestClient) -> None:
    response = client.post(
        "/api/v1/plants/",
        json={
            "name": "Ghost Plant",
            "species": "Monotropa uniflora",
            "village_id": str(uuid4()),
        },
    )
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["field"] == "village_id"
