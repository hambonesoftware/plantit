"""Seed the database with demo content."""
from __future__ import annotations

from datetime import datetime, timezone, date

from sqlalchemy.orm import Session

from backend.data import seed_content
from backend.db import models


def _parse_datetime(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _parse_date(value: str | None) -> date | None:
    if value is None:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def seed_demo_data(session: Session) -> None:
    """Populate the database with the canonical seed data when empty."""

    has_villages = session.query(models.Village).first() is not None
    if has_villages:
        return

    villages = {
        village["id"]: models.Village(
            id=village["id"],
            name=village["name"],
            climate=village["climate"],
            description=village["description"],
            established_at=_parse_date(village["established_at"]),
            irrigation_type=village["irrigation_type"],
            health_score=village["health_score"],
        )
        for village in seed_content.VILLAGES
    }
    session.add_all(villages.values())
    session.flush()

    plants = {
        plant["id"]: models.Plant(
            id=plant["id"],
            village_id=plant["village_id"],
            display_name=plant["display_name"],
            species=plant["species"],
            stage=plant["stage"],
            last_watered_at=_parse_datetime(plant["last_watered_at"]),
            health_score=plant["health_score"],
            notes=plant["notes"],
        )
        for plant in seed_content.PLANTS
    }
    session.add_all(plants.values())
    session.flush()

    tasks = [
        models.Task(
            id=task["id"],
            task_type=task["type"],
            plant_id=task["plant_id"],
            plant_name=task["plant_name"],
            village_name=task["village_name"],
            due_at=_parse_datetime(task["due_at"]),
            priority=task["priority"],
        )
        for task in seed_content.TODAY_TASKS
    ]
    session.add_all(tasks)
