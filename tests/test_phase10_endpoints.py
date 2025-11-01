"""Integration tests for Phase 10 read-path endpoints."""
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app import app
from backend.db import models
from backend.db.session import session_scope

client = TestClient(app)


def _get_first_village_id() -> str:
    response = client.get("/api/villages")
    assert response.status_code == 200, response.text
    payload = response.json()
    villages = payload.get("villages")
    assert isinstance(villages, list) and villages, "Expected seeded villages"
    return villages[0]["id"]


def _create_village() -> dict:
    payload = {
        "name": f"Test Village {uuid4().hex[:8]}",
        "climate": "Temperate",
        "healthScore": 0.65,
        "description": "Integration test village",
        "irrigationType": "manual",
        "establishedAt": "2021-01-01",
    }
    response = client.post("/api/villages", json=payload)
    assert response.status_code == 201, response.text
    village = response.json().get("village")
    assert isinstance(village, dict)
    return village


def _create_plant(village_id: str) -> dict:
    payload = {
        "villageId": village_id,
        "displayName": f"Test Plant {uuid4().hex[:6]}",
        "species": "Testus plantus",
        "stage": "seedling",
        "lastWateredAt": "2024-04-12T09:00:00Z",
        "healthScore": 0.55,
        "notes": "Created via integration test",
    }
    response = client.post("/api/plants", json=payload)
    assert response.status_code == 201, response.text
    plant = response.json().get("plant")
    assert isinstance(plant, dict)
    return plant


def _create_task(plant_id: str, plant_name: str, village_name: str) -> str:
    task_id = f"task-{uuid4().hex[:8]}"
    with session_scope() as session:
        session.add(
            models.Task(
                id=task_id,
                task_type="inspect",
                plant_id=plant_id,
                plant_name=plant_name,
                village_name=village_name,
                due_at=datetime.now(timezone.utc),
                priority="medium",
            )
        )
    return task_id


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

    expected_village_keys = {
        "id",
        "name",
        "climate",
        "plantCount",
        "healthScore",
        "updatedAt",
    }
    assert expected_village_keys.issubset(village.keys())

    expected_plant_keys = {
        "id",
        "displayName",
        "species",
        "stage",
        "lastWateredAt",
        "healthScore",
        "updatedAt",
        "notes",
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


def test_create_update_delete_village_flow() -> None:
    village = _create_village()
    village_id = village["id"]

    update_payload = {
        "name": village["name"] + " Updated",
        "climate": village["climate"],
        "healthScore": village["healthScore"],
        "description": "Updated via test",
        "irrigationType": "drip",
        "establishedAt": village.get("establishedAt"),
        "updatedAt": village["updatedAt"],
    }
    response = client.put(f"/api/villages/{village_id}", json=update_payload)
    assert response.status_code == 200, response.text
    updated_village = response.json().get("village")
    assert updated_village["name"].endswith("Updated")

    delete_response = client.request(
        "DELETE",
        f"/api/villages/{village_id}",
        json={"updatedAt": updated_village["updatedAt"]},
    )
    assert delete_response.status_code == 200, delete_response.text

    final_lookup = client.get(f"/api/villages/{village_id}")
    assert final_lookup.status_code == 404


def test_village_update_conflict_returns_409() -> None:
    village = _create_village()
    village_id = village["id"]

    first_update = {
        "name": village["name"],
        "climate": village["climate"],
        "healthScore": village["healthScore"],
        "description": village.get("description"),
        "irrigationType": village.get("irrigationType"),
        "establishedAt": village.get("establishedAt"),
        "updatedAt": village["updatedAt"],
    }
    response = client.put(f"/api/villages/{village_id}", json=first_update)
    assert response.status_code == 200, response.text
    latest = response.json().get("village")

    conflict_response = client.put(
        f"/api/villages/{village_id}",
        json={**first_update, "updatedAt": village["updatedAt"]},
    )
    assert conflict_response.status_code == 409, conflict_response.text

    client.request(
        "DELETE",
        f"/api/villages/{village_id}",
        json={"updatedAt": latest["updatedAt"]},
    )


def test_create_update_delete_plant_flow() -> None:
    village = _create_village()
    plant = _create_plant(village["id"])

    update_payload = {
        "displayName": plant["displayName"] + " Updated",
        "species": plant["species"],
        "stage": plant["stage"],
        "lastWateredAt": plant.get("lastWateredAt"),
        "healthScore": plant["healthScore"],
        "notes": "Updated via test",
        "updatedAt": plant["updatedAt"],
    }
    response = client.put(f"/api/plants/{plant['id']}", json=update_payload)
    assert response.status_code == 200, response.text
    update_payload_json = response.json()
    updated_plant = update_payload_json.get("plant")
    updated_village_summary = update_payload_json.get("village")
    assert updated_plant["displayName"].endswith("Updated")

    delete_response = client.request(
        "DELETE",
        f"/api/plants/{plant['id']}",
        json={"updatedAt": updated_plant["updatedAt"]},
    )
    assert delete_response.status_code == 200, delete_response.text

    missing = client.get(f"/api/plants/{plant['id']}")
    assert missing.status_code == 404

    client.request(
        "DELETE",
        f"/api/villages/{village['id']}",
        json={"updatedAt": (updated_village_summary or village)["updatedAt"]},
    )


def test_update_plant_conflict_returns_409() -> None:
    village = _create_village()
    plant = _create_plant(village["id"])

    first_update = {
        "displayName": plant["displayName"],
        "species": plant["species"],
        "stage": plant["stage"],
        "lastWateredAt": plant.get("lastWateredAt"),
        "healthScore": plant["healthScore"],
        "notes": plant.get("notes"),
        "updatedAt": plant["updatedAt"],
    }
    response = client.put(f"/api/plants/{plant['id']}", json=first_update)
    assert response.status_code == 200, response.text
    update_json = response.json()
    latest = update_json.get("plant")
    updated_village = update_json.get("village")

    conflict = client.put(
        f"/api/plants/{plant['id']}",
        json={**first_update, "updatedAt": plant["updatedAt"]},
    )
    assert conflict.status_code == 409, conflict.text

    client.request(
        "DELETE",
        f"/api/plants/{plant['id']}",
        json={"updatedAt": latest["updatedAt"]},
    )
    client.request(
        "DELETE",
        f"/api/villages/{village['id']}",
        json={"updatedAt": (updated_village or village)["updatedAt"]},
    )


def test_delete_village_removes_dependent_records() -> None:
    village = _create_village()
    village_id = village["id"]

    plant = _create_plant(village_id)
    plant_id = plant["id"]
    task_id = _create_task(plant_id, plant["displayName"], village["name"])

    detail_response = client.get(f"/api/villages/{village_id}")
    assert detail_response.status_code == 200, detail_response.text
    updated_village = detail_response.json().get("village")
    assert isinstance(updated_village, dict)

    delete_response = client.request(
        "DELETE",
        f"/api/villages/{village_id}",
        json={"updatedAt": updated_village["updatedAt"]},
    )
    assert delete_response.status_code == 200, delete_response.text

    with session_scope() as session:
        assert session.get(models.Village, village_id) is None
        assert session.get(models.Plant, plant_id) is None
        assert session.get(models.Task, task_id) is None
