"""Seed the database with demo content."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, Iterable, List

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


def _clean_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _sanitize_activity_log(entries: Any) -> List[Dict[str, Any]]:
    sanitized: List[Dict[str, Any]] = []
    if not isinstance(entries, Iterable) or isinstance(entries, (str, bytes)):
        return sanitized
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        date_value = entry.get("date")
        date_iso = None
        if isinstance(date_value, str):
            try:
                parsed = _parse_date(date_value)
            except ValueError:
                parsed = None
            if parsed:
                date_iso = parsed.isoformat()
        note = _clean_text(entry.get("note")) or ""
        entry_type = _clean_text(entry.get("type")) or "note"
        sanitized_entry: Dict[str, Any] = {"date": date_iso, "type": entry_type, "note": note}
        amount = _clean_text(entry.get("amount"))
        if amount:
            sanitized_entry["amount"] = amount
        method = _clean_text(entry.get("method"))
        if method:
            sanitized_entry["method"] = method
        sanitized.append(sanitized_entry)
    return sanitized


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
            image_url=plant.get("image_url"),
            family=_clean_text(plant.get("family")),
            plant_origin=_clean_text(plant.get("plant_origin")),
            natural_habitat=_clean_text(plant.get("natural_habitat")),
            room=_clean_text(plant.get("room")),
            sunlight=_clean_text(plant.get("sunlight")),
            pot_size=_clean_text(plant.get("pot_size")),
            purchased_on=_parse_date(plant.get("purchased_on")),
            last_watered=_parse_date(plant.get("last_watered")),
            last_repotted=_parse_date(plant.get("last_repotted")),
            dormancy=_clean_text(plant.get("dormancy")),
            water_average=_clean_text(plant.get("water_average")),
            amount=_clean_text(plant.get("amount")),
            activity_log=_sanitize_activity_log(plant.get("activity_log")) or None,
        )
        for plant in seed_content.PLANTS
    }
    session.add_all(plants.values())
    session.flush()

    watering_events: list[models.PlantWateringEvent] = []
    for plant_id, dates in seed_content.PLANT_WATERINGS.items():
        plant = plants.get(plant_id)
        if plant is None:
            continue
        for index, watered_at in enumerate(dates, start=1):
            parsed = _parse_date(watered_at)
            if parsed is None:
                continue
            watering_events.append(
                models.PlantWateringEvent(
                    id=f"{plant_id}-watering-{index}",
                    plant=plant,
                    watered_at=parsed,
                )
            )

    if watering_events:
        session.add_all(watering_events)

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
