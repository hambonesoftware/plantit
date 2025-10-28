"""Domain services for computing aggregated metrics."""
from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import func, select
from sqlmodel import Session

from backend.models import Plant, Task, TaskStatus, Village


def count_villages(session: Session) -> int:
    """Return the number of villages in the system."""
    statement = select(func.count()).select_from(Village)
    return int(session.exec(statement).one()[0])


def count_plants(session: Session) -> int:
    """Return the number of plants in the system."""
    statement = select(func.count()).select_from(Plant)
    return int(session.exec(statement).one()[0])


def village_plant_totals(session: Session) -> Dict[str, int]:
    """Return a mapping of village ID to the number of plants it contains."""
    results: Dict[str, int] = {}
    statement = select(Plant.village_id, func.count()).group_by(Plant.village_id)
    for village_id, total in session.exec(statement):
        results[str(village_id)] = int(total)
    return results


def village_summaries(session: Session) -> List[dict]:
    """Return per-village summaries including plant totals and last activity."""

    statement = (
        select(
            Village.id,
            Village.name,
            Village.location,
            Village.updated_at,
            func.count(Plant.id).label("plant_total"),
            func.max(Plant.updated_at).label("last_plant"),
        )
        .join(Plant, Plant.village_id == Village.id, isouter=True)
        .group_by(Village.id)
        .order_by(Village.name)
    )
    payload: List[dict] = []
    for row in session.exec(statement):
        village_id, name, location, updated_at, plant_total, last_plant = row
        last_activity = updated_at
        if last_plant and (last_activity is None or last_plant > last_activity):
            last_activity = last_plant
        payload.append(
            {
                "id": str(village_id),
                "name": name,
                "location": location,
                "plant_total": int(plant_total or 0),
                "last_activity": last_activity.isoformat() if last_activity else None,
            }
        )
    return payload


def recent_plants(session: Session, limit: int = 5) -> List[dict]:
    """Return a list of recently updated plants."""

    statement = (
        select(
            Plant.id,
            Plant.name,
            Plant.village_id,
            Plant.updated_at,
        )
        .order_by(Plant.updated_at.desc())
        .limit(limit)
    )
    payload: List[dict] = []
    for plant_id, name, village_id, updated_at in session.exec(statement):
        payload.append(
            {
                "id": str(plant_id),
                "name": name,
                "village_id": str(village_id),
                "updated_at": updated_at.isoformat() if updated_at else None,
            }
        )
    return payload


def tasks_overview(session: Session, reference: Optional[date] = None) -> dict:
    """Return aggregated task information for the home dashboard."""

    today = reference or date.today()
    due_today: List[dict] = []
    overdue_count = 0
    next_task: Optional[dict] = None

    statement = (
        select(
            Task.id,
            Task.title,
            Task.due_date,
            Task.care_profile_id,
            Task.plant_id,
            Plant.name.label("plant_name"),
            Plant.village_id,
        )
        .join(Plant, Plant.id == Task.plant_id)
        .where(Task.status == TaskStatus.PENDING)
        .order_by(Task.due_date, Task.created_at)
    )

    for row in session.exec(statement):
        task_id, title, due_date, care_profile_id, plant_id, plant_name, village_id = row
        entry = {
            "id": str(task_id),
            "title": title,
            "due_date": due_date.isoformat(),
            "care_profile_id": str(care_profile_id) if care_profile_id else None,
            "plant": {
                "id": str(plant_id),
                "name": plant_name,
                "village_id": str(village_id),
            },
        }
        if due_date < today:
            overdue_count += 1
        elif due_date == today:
            due_today.append(entry)
        elif next_task is None:
            next_task = entry

    return {
        "due_today": due_today,
        "overdue_count": overdue_count,
        "next_task": next_task,
    }
