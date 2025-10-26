"""Tests for dashboard aggregates."""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Log, Photo, Plant, Task, TaskState, Village


def _add_task(
    session: Session,
    *,
    plant: Plant,
    title: str,
    due: date | None,
    state: TaskState = TaskState.pending,
) -> Task:
    task = Task(plant_id=plant.id, title=title, due_date=due, state=state)
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def test_dashboard_aggregates(client: TestClient, session: Session) -> None:
    today = date(2024, 1, 10)

    village = Village(name="Herb Patch", description="")
    other_village = Village(name="Citrus Grove", description="")
    session.add(village)
    session.add(other_village)
    session.commit()
    session.refresh(village)
    session.refresh(other_village)

    plant = Plant(village_id=village.id, name="Mint", species="Mentha")
    other_plant = Plant(village_id=village.id, name="Basil", species="Ocimum")
    session.add(plant)
    session.add(other_plant)
    citrus = Plant(village_id=other_village.id, name="Lemon", species="Citrus limon")
    session.add(citrus)
    session.commit()
    session.refresh(plant)
    session.refresh(other_plant)
    session.refresh(citrus)

    _add_task(session, plant=plant, title="Water mint", due=today)
    _add_task(session, plant=plant, title="Fertilize mint", due=today - date.resolution)
    _add_task(session, plant=other_plant, title="Prune basil", due=today + date.resolution)
    _add_task(
        session,
        plant=other_plant,
        title="Completed task",
        due=today,
        state=TaskState.completed,
    )

    log = Log(
        plant_id=plant.id,
        action="Watered",
        notes="Soaked thoroughly",
        performed_at=datetime(2024, 1, 8, 8, 0, tzinfo=timezone.utc),
    )
    session.add(log)

    photo = Photo(
        plant_id=plant.id,
        filename="mint.jpg",
        file_path="2024/01/mint.jpg",
        thumbnail_path="2024/01/thumb_mint.jpg",
        content_type="image/jpeg",
        size_bytes=1024,
        width=800,
        height=600,
        captured_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    session.add(photo)
    session.commit()

    response = client.get("/api/v1/dashboard", params={"today": today.isoformat()})
    assert response.status_code == 200
    payload = response.json()

    assert len(payload["villages"]) == 2
    herb_summary = next(item for item in payload["villages"] if item["id"] == village.id)
    assert herb_summary["plant_count"] == 2
    assert herb_summary["due_today"] == 1
    assert herb_summary["overdue"] == 1
    assert herb_summary["last_watered_days"] == 2
    assert herb_summary["cover_photo"] == "2024/01/thumb_mint.jpg"

    today_tasks = payload["today"]
    assert len(today_tasks) == 1
    task_entry = today_tasks[0]
    assert task_entry["plant"]["name"] == "Mint"
    assert task_entry["village"]["name"] == "Herb Patch"

    calendar = {bucket["date"]: bucket["count"] for bucket in payload["calendar"]}
    assert calendar[today.isoformat()] == 1
    tomorrow = (today + date.resolution).isoformat()
    assert calendar[tomorrow] == 1
