"""Tests for tasks and care profile APIs."""
from __future__ import annotations

from fastapi.testclient import TestClient


def _create_plant(client: TestClient) -> str:
    village = client.post(
        "/api/v1/villages/",
        json={
            "name": "Task Village",
            "location": "Denver",
            "description": "Testing plots.",
        },
    ).json()
    plant = client.post(
        "/api/v1/plants/",
        json={
            "name": "Rosemary",
            "species": "Salvia rosmarinus",
            "village_id": village["id"],
        },
    ).json()
    return plant["id"]


def test_care_profile_creates_tasks_and_schedules_follow_up(client: TestClient) -> None:
    plant_id = _create_plant(client)
    profile = client.post(
        "/api/v1/care-profiles/",
        json={
            "plant_id": plant_id,
            "title": "Water",
            "cadence_type": "interval",
            "interval_days": 3,
        },
    ).json()

    tasks = client.get("/api/v1/tasks/", params={"plant_id": plant_id}).json()
    assert len(tasks) == 1
    first_task = tasks[0]
    assert first_task["status"] == "pending"

    complete = client.patch(
        f"/api/v1/tasks/{first_task['id']}",
        json={"status": "completed"},
    ).json()
    assert complete["status"] == "completed"

    pending = client.get(
        "/api/v1/tasks/",
        params={"plant_id": plant_id, "status": "pending"},
    ).json()
    assert len(pending) == 1
    next_task = pending[0]
    assert next_task["due_date"] > first_task["due_date"]

    client.delete(f"/api/v1/care-profiles/{profile['id']}")
    remaining = client.get(
        "/api/v1/tasks/",
        params={"plant_id": plant_id, "status": "pending"},
    ).json()
    assert remaining == []


def test_weekly_profile_requires_days(client: TestClient) -> None:
    plant_id = _create_plant(client)
    response = client.post(
        "/api/v1/care-profiles/",
        json={
            "plant_id": plant_id,
            "title": "Prune",
            "cadence_type": "weekly",
            "weekly_days": [],
        },
    )
    assert response.status_code == 422
    payload = response.json()
    assert payload["error"]["field"] == "weekly_days"
