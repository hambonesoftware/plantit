"""CRUD tests for village endpoints."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_village_crud_flow(client: TestClient) -> None:
    create_payload = {
        "name": "River Gardens",
        "location": "Denver",
        "description": "A collaborative urban farming initiative.",
    }
    response = client.post("/api/v1/villages/", json=create_payload)
    assert response.status_code == 201
    created = response.json()
    village_id = created["id"]

    list_response = client.get("/api/v1/villages/")
    assert list_response.status_code == 200
    list_etag = list_response.headers.get("ETag")
    assert list_etag
    not_modified = client.get("/api/v1/villages/", headers={"If-None-Match": list_etag})
    assert not_modified.status_code == 304

    detail_response = client.get(f"/api/v1/villages/{village_id}")
    assert detail_response.status_code == 200
    detail_etag = detail_response.headers.get("ETag")
    assert detail_etag
    detail_payload = detail_response.json()
    assert detail_payload["name"] == create_payload["name"]

    update_response = client.patch(
        f"/api/v1/villages/{village_id}", json={"description": "Now expanded with greenhouse."}
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "Now expanded with greenhouse."

    refreshed_detail = client.get(f"/api/v1/villages/{village_id}")
    assert refreshed_detail.status_code == 200
    assert refreshed_detail.headers.get("ETag") != detail_etag

    delete_response = client.delete(f"/api/v1/villages/{village_id}")
    assert delete_response.status_code == 204

    missing_response = client.get(f"/api/v1/villages/{village_id}")
    assert missing_response.status_code == 404
    assert missing_response.json()["error"]["code"] == "NOT_FOUND"
