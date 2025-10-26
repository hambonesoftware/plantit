"""Dashboard aggregate services."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable

from sqlmodel import Session, select

from backend.models import Log, Photo, Plant, Task, TaskState, Village


@dataclass
class VillageSummary:
    id: int
    name: str
    plant_count: int
    due_today: int
    overdue: int
    last_watered_days: int | None
    cover_photo: str | None


@dataclass
class TaskSummary:
    id: int
    title: str
    due_date: date | None
    plant_id: int
    plant_name: str
    village_id: int
    village_name: str


@dataclass
class CalendarBucket:
    date: date
    count: int


def build_dashboard(session: Session, today: date | None = None) -> dict[str, object]:
    """Return aggregated dashboard data for villages, tasks, and calendar."""

    today_date = today or date.today()

    villages = session.exec(select(Village)).all()
    plants = session.exec(select(Plant)).all()
    tasks = session.exec(select(Task)).all()
    logs = session.exec(select(Log)).all()
    photos = session.exec(select(Photo).order_by(Photo.captured_at.desc())).all()

    plants_by_village: dict[int, list[Plant]] = defaultdict(list)
    for plant in plants:
        plants_by_village[plant.village_id].append(plant)

    tasks_by_plant: dict[int, list[Task]] = defaultdict(list)
    for task in tasks:
        tasks_by_plant[task.plant_id].append(task)

    latest_water_logs: dict[int, Log] = {}
    for log in logs:
        if not log.action:
            continue
        if "water" not in log.action.lower():
            continue
        existing = latest_water_logs.get(log.plant_id)
        if existing is None or log.performed_at > existing.performed_at:
            latest_water_logs[log.plant_id] = log

    cover_photos: dict[int, str] = {}
    for photo in photos:
        cover_photos.setdefault(photo.plant_id, photo.thumbnail_path)

    today_tasks: list[TaskSummary] = []
    calendar_range = [today_date + timedelta(days=offset) for offset in range(42)]
    calendar_counts: dict[date, int] = {bucket: 0 for bucket in calendar_range}

    village_summaries: list[VillageSummary] = []

    for village in villages:
        village_plants = plants_by_village.get(village.id, [])
        plant_ids = {plant.id for plant in village_plants}

        due_today = 0
        overdue = 0
        for plant in village_plants:
            for task in tasks_by_plant.get(plant.id, []):
                if task.state != TaskState.pending:
                    continue
                if task.due_date is None:
                    continue
                if task.due_date == today_date:
                    due_today += 1
                    today_tasks.append(
                        TaskSummary(
                            id=task.id,
                            title=task.title,
                            due_date=task.due_date,
                            plant_id=plant.id,
                            plant_name=plant.name,
                            village_id=village.id,
                            village_name=village.name,
                        )
                    )
                elif task.due_date < today_date:
                    overdue += 1
                if today_date <= task.due_date <= calendar_range[-1]:
                    calendar_counts[task.due_date] += 1

        last_watered_days = None
        relevant_logs = [latest_water_logs.get(pid) for pid in plant_ids]
        relevant_logs = [log for log in relevant_logs if log is not None]
        if relevant_logs:
            most_recent = max(relevant_logs, key=lambda log: log.performed_at)
            last_watered_days = (today_date - most_recent.performed_at.date()).days

        cover_photo = None
        for plant in village_plants:
            if plant.id in cover_photos:
                cover_photo = cover_photos[plant.id]
                break

        village_summaries.append(
            VillageSummary(
                id=village.id,
                name=village.name,
                plant_count=len(village_plants),
                due_today=due_today,
                overdue=overdue,
                last_watered_days=last_watered_days,
                cover_photo=cover_photo,
            )
        )

    today_tasks.sort(key=lambda item: (item.due_date or today_date, item.title))

    calendar_buckets = [
        CalendarBucket(date=bucket, count=calendar_counts[bucket]) for bucket in calendar_range
    ]

    return {
        "villages": [
            {
                "id": summary.id,
                "name": summary.name,
                "plant_count": summary.plant_count,
                "due_today": summary.due_today,
                "overdue": summary.overdue,
                "last_watered_days": summary.last_watered_days,
                "cover_photo": summary.cover_photo,
            }
            for summary in village_summaries
        ],
        "today": [
            {
                "id": task.id,
                "title": task.title,
                "due_date": task.due_date,
                "plant": {"id": task.plant_id, "name": task.plant_name},
                "village": {"id": task.village_id, "name": task.village_name},
            }
            for task in today_tasks
        ],
        "calendar": [
            {"date": bucket.date, "count": bucket.count}
            for bucket in calendar_buckets
        ],
    }
