"""Integration tests for Phase 10 read-path endpoints."""
from fastapi.testclient import TestClient

from backend.app import app

client = TestClient(app)


def _get_first_village_id() -> str:
    response = client.get("/api/villages")
    assert response.status_code == 200, response.text
    payload = response.json()
    villages = payload.get("villages")
    assert isinstance(villages, list) and villages, "Expected seeded villages"
    return villages[0]["id"]


def test_list_village_plants_returns_seeded_plants() -> None:
    village_id = _get_first_village_id()

    response = client.get(f"/api/villages/{village_id}/plants")
    assert response.status_code == 200, response.text

    payload = response.json()
    village = payload.get("village")
    plants = payload.get("plants")

    assert isinstance(village, dict), "Village summary missing"
    assert village.get("id") == village_id

    assert isinstance(plants, list), "Plants payload missing"
    assert village.get("plantCount") == len(plants)

    expected_village_keys = {"id", "name", "climate", "plantCount", "healthScore"}
    assert expected_village_keys.issubset(village.keys())

    expected_plant_keys = {
        "id",
        "displayName",
        "species",
        "stage",
        "lastWateredAt",
        "healthScore",
    }
    for plant in plants:
        assert expected_plant_keys.issubset(plant.keys()), plant


def test_today_endpoint_returns_tasks() -> None:
    response = client.get("/api/today")
    assert response.status_code == 200, response.text

    payload = response.json()
    tasks = payload.get("tasks")
    empty_message = payload.get("emptyStateMessage")

    assert isinstance(tasks, list), "Tasks payload missing"
    assert empty_message is None or isinstance(empty_message, str)

    if tasks:
        expected_task_keys = {
            "id",
            "type",
            "plantId",
            "plantName",
            "villageName",
            "dueAt",
            "priority",
        }
        for task in tasks:
            assert expected_task_keys.issubset(task.keys()), task
