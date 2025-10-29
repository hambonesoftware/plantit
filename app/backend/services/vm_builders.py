"""Utilities for building view models consumed by the frontend."""
from __future__ import annotations

from datetime import datetime
from typing import Iterable

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from ..models import Log, Plant, Task, Village
from ..utils import ensure_utc, utc_now
from ..viewmodels.common import CalendarDot, CalendarVM, TaskVM, VillageCardVM
from ..viewmodels.dashboard import DashboardVM
from ..viewmodels.plant import LogItem, PlantVM
from ..viewmodels.today import TodayVM
from ..viewmodels.village import PlantBrief, VillageVM


def _resolve_latest(datetimes: Iterable[datetime | None]) -> datetime | None:
    """Return the most recent timestamp, handling ``None`` values gracefully."""

    latest: datetime | None = None
    for value in datetimes:
        if value is None:
            continue
        candidate = ensure_utc(value)
        if latest is None or candidate > latest:
            latest = candidate
    return latest


def human_since(dt: datetime | None) -> str:
    if dt is None:
        return "—"
    baseline = ensure_utc(dt)
    delta = utc_now() - baseline
    days = delta.days
    if days <= 0:
        return "today"
    if days == 1:
        return "1 day ago"
    return f"{days} days ago"


def build_village_card(session: Session, village: Village) -> VillageCardVM:
    today = utc_now()
    due_today = (
        session.query(Task)
        .join(Plant)
        .filter(
            Plant.village_id == village.id,
            Task.done_at == None,  # noqa: E711 - SQLAlchemy comparison
            func.date(Task.due_date) <= func.date(today),
        )
        .count()
    )
    overdue = (
        session.query(Task)
        .join(Plant)
        .filter(
            Plant.village_id == village.id,
            Task.done_at == None,  # noqa: E711 - SQLAlchemy comparison
            func.date(Task.due_date) < func.date(today),
        )
        .count()
    )
    last_watered = _resolve_latest(p.last_watered_at for p in village.plants)
    return VillageCardVM(
        id=village.id,
        name=village.name,
        due_today=due_today,
        overdue=overdue,
        last_watered_human=human_since(last_watered),
    )


def build_today_list(session: Session) -> list[TaskVM]:
    today = utc_now()
    query = (
        session.query(Task, Plant, Village)
        .join(Plant, Task.plant_id == Plant.id)
        .join(Village, Plant.village_id == Village.id)
        .filter(Task.done_at == None, func.date(Task.due_date) <= func.date(today))  # noqa: E711
        .order_by(Task.due_date.asc())
    )

    items: list[TaskVM] = []
    for task, plant, village in query:
        due_date = ensure_utc(task.due_date)
        overdue_days = max(0, (today.date() - due_date.date()).days)
        items.append(
            TaskVM(
                id=task.id,
                plant_id=plant.id,
                village_id=village.id,
                kind=task.kind,
                due_date=due_date,
                overdue_days=overdue_days,
                plant_name=plant.name,
                village_name=village.name,
            )
        )
    return items


def build_calendar(session: Session) -> CalendarVM:
    now = utc_now()
    query = (
        session.query(func.date(Task.due_date), func.count())
        .filter(extract("month", Task.due_date) == now.month, extract("year", Task.due_date) == now.year)
        .group_by(func.date(Task.due_date))
    )
    dots = []
    for day_str, count in query:
        day = int(str(day_str).split("-")[-1])
        dots.append(CalendarDot(day=day, count=count))
    return CalendarVM(year=now.year, month=now.month, dots=dots)


def build_dashboard(session: Session) -> DashboardVM:
    villages = session.query(Village).order_by(Village.name.asc()).all()
    cards = [build_village_card(session, village) for village in villages]
    today_list = build_today_list(session)
    calendar = build_calendar(session)
    return DashboardVM(villages=cards, today=today_list, calendar=calendar)


def build_village(session: Session, village_id: int) -> VillageVM:
    village = session.get(Village, village_id)
    if not village:
        raise ValueError("Village not found")

    plants = [
        PlantBrief(
            id=plant.id,
            name=plant.name,
            species=plant.species,
            last_watered_human=human_since(plant.last_watered_at),
        )
        for plant in village.plants
    ]
    card = build_village_card(session, village)
    return VillageVM(id=village.id, name=village.name, plants=plants, due_today=card.due_today, overdue=card.overdue)


def build_plant(session: Session, plant_id: int) -> PlantVM:
    plant = session.get(Plant, plant_id)
    if not plant:
        raise ValueError("Plant not found")

    village = session.get(Village, plant.village_id)
    logs = [LogItem(ts=ensure_utc(log.ts), kind=log.kind, note=log.note) for log in plant.logs]
    return PlantVM(
        id=plant.id,
        village_id=plant.village_id,
        village_name=village.name if village else "",
        name=plant.name,
        species=plant.species,
        last_watered_human=human_since(plant.last_watered_at),
        frequency_days=plant.frequency_days,
        logs=logs,
    )


def build_today(session: Session) -> TodayVM:
    return TodayVM(today=build_today_list(session))
