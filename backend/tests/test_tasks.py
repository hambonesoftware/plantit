from datetime import date, timedelta

import pytest

from sqlmodel import select

from backend.models import Plant, Task
from backend.models.task import TaskCategory, TaskState


@pytest.fixture()
def plant_with_task(session):
    plant = Plant(
        village_id=1,
        name="Aloe",
        species="Aloe vera",
        care_profile={
            "watering_interval_days": 3,
            "feeding_interval_days": None,
            "pruning_interval_days": None,
            "misting_interval_days": None,
            "notes": None,
            "updated_at": None,
        },
    )
    session.add(plant)
    session.commit()
    session.refresh(plant)
    task = Task(
        plant_id=plant.id,
        title="Water plant",
        category=TaskCategory.watering,
        due_date=date.today(),
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return plant, task


def test_list_tasks_returns_tasks(client, session, plant_with_task):
    plant, task = plant_with_task
    response = client.get("/api/v1/tasks")
    assert response.status_code == 200
    data = response.json()
    assert any(item["id"] == task.id for item in data)
    assert data[0]["plant"]["id"] == plant.id


def test_patch_task_schedules_follow_up(client, session, plant_with_task):
    plant, task = plant_with_task
    response = client.patch(f"/api/v1/tasks/{task.id}", json={"state": "completed"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == TaskState.completed.value
    session.expire_all()
    refreshed = session.get(Task, task.id)
    assert refreshed.state == TaskState.completed
    pending_tasks = session.exec(
        select(Task).where(
            Task.plant_id == plant.id,
            Task.category == TaskCategory.watering,
            Task.state == TaskState.pending,
        )
    ).all()
    assert len(pending_tasks) == 1
    assert pending_tasks[0].due_date == date.today() + timedelta(days=3)


def test_batch_update_adjusts_due_date(client, session, plant_with_task):
    plant, task = plant_with_task
    second = Task(
        plant_id=plant.id,
        title="Inspect",
        category=TaskCategory.inspection,
        due_date=date.today(),
    )
    session.add(second)
    session.commit()
    session.refresh(second)
    new_due = date.today() + timedelta(days=5)
    response = client.post(
        "/api/v1/tasks/batch",
        json={"task_ids": [task.id, second.id], "due_date": new_due.isoformat()},
    )
    assert response.status_code == 200
    results = {item["id"]: item for item in response.json()}
    assert results[task.id]["due_date"] == new_due.isoformat()
    assert results[second.id]["due_date"] == new_due.isoformat()
