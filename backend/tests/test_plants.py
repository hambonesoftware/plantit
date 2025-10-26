from datetime import date

import pytest
from fastapi import status

from backend.models import Plant, Village
from backend.models.task import TaskCategory, TaskState


@pytest.fixture()
def sample_village(session):
    village = Village(name="Greenhouse")
    session.add(village)
    session.commit()
    session.refresh(village)
    return village


@pytest.fixture()
def sample_plant(session, sample_village):
    plant = Plant(village_id=sample_village.id, name="Fern", species="Boston fern")
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return plant


def test_list_plants_returns_items(client, session, sample_plant):
    response = client.get("/api/v1/plants")
    assert response.status_code == 200
    payload = response.json()
    assert "items" in payload
    assert any(item["id"] == sample_plant.id for item in payload["items"])


def test_create_plant_persists_record(client, session, sample_village):
    response = client.post(
        "/api/v1/plants",
        json={"name": "Sprout", "village_id": sample_village.id, "species": "Aloe"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "Sprout"
    assert data["village_id"] == sample_village.id
    session.refresh(sample_village)
    created = session.get(Plant, data["id"])
    assert created is not None
    assert created.village_id == sample_village.id


def test_create_plant_requires_existing_village(client):
    response = client.post("/api/v1/plants", json={"name": "Orphan", "village_id": 9999})
    assert response.status_code == status.HTTP_404_NOT_FOUND
    payload = response.json()
    assert payload["detail"] == "Village not found"


def test_get_plant_detail_includes_profile_and_metrics(client, session, sample_plant):
    response = client.get(f"/api/v1/plants/{sample_plant.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == sample_plant.id
    care = data["care_profile"]
    assert care["feeding_interval_days"] is None
    assert care["watering_interval_days"] is None
    assert care["updated_at"] is None
    assert data["metrics"]["due_tasks"] == 0


def test_patch_plant_updates_fields(client, session, sample_plant):
    response = client.patch(
        f"/api/v1/plants/{sample_plant.id}",
        json={"name": "Ferny", "tags": ["shade"]},
    )
    assert response.status_code == 200
    session.refresh(sample_plant)
    assert sample_plant.name == "Ferny"
    assert sample_plant.tags == ["shade"]


def test_move_plant_updates_village(client, session, sample_plant, sample_village):
    destination = Village(name="Sunny Patch")
    session.add(destination)
    session.commit()
    session.refresh(destination)

    response = client.post(
        f"/api/v1/plants/{sample_plant.id}:move",
        json={"destination_village_id": destination.id},
    )
    assert response.status_code == status.HTTP_200_OK
    session.refresh(sample_plant)
    assert sample_plant.village_id == destination.id


def test_move_plant_rejects_missing_destination(client, sample_plant):
    response = client.post(
        f"/api/v1/plants/{sample_plant.id}:move",
        json={"destination_village_id": 0},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND
    payload = response.json()
    assert payload["detail"] == "Destination village not found"


def test_care_profile_update_schedules_task(client, session, sample_plant):
    response = client.put(
        f"/api/v1/plants/{sample_plant.id}/care_profile",
        json={"watering_interval_days": 3},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["care_profile"]["watering_interval_days"] == 3
    tasks = data["tasks"]
    assert any(task["category"] == "watering" for task in tasks)


def test_post_log_creates_entry(client, session, sample_plant):
    response = client.post(
        f"/api/v1/plants/{sample_plant.id}/logs",
        json={"action": "watered", "notes": "Soaked"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["action"] == "watered"


def test_schedule_task_creates_pending_task(client, session, sample_plant):
    response = client.post(
        f"/api/v1/plants/{sample_plant.id}/tasks",
        json={
            "title": "Inspect leaves",
            "due_date": date.today().isoformat(),
            "category": TaskCategory.inspection.value,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Inspect leaves"
    assert data["state"] == TaskState.pending.value
