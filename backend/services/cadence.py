"""Utilities for computing care cadence schedules."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from sqlmodel import Session

from backend.models import Log, Plant, Task
from backend.models.task import TaskCategory, TaskState
from backend.schemas.log import LogRead
from backend.schemas.plant import PlantCareProfile
from backend.services.timeutils import utcnow

_CATEGORY_FIELDS: dict[TaskCategory, str] = {
    TaskCategory.watering: "watering_interval_days",
    TaskCategory.feeding: "feeding_interval_days",
    TaskCategory.pruning: "pruning_interval_days",
    TaskCategory.misting: "misting_interval_days",
}

_CATEGORY_ACTIONS: dict[TaskCategory, str] = {
    TaskCategory.watering: "watered",
    TaskCategory.feeding: "fed",
    TaskCategory.pruning: "pruned",
    TaskCategory.misting: "misted",
    TaskCategory.inspection: "inspected",
}

_CATEGORY_TITLES: dict[TaskCategory, str] = {
    TaskCategory.watering: "Water plant",
    TaskCategory.feeding: "Feed plant",
    TaskCategory.pruning: "Prune plant",
    TaskCategory.misting: "Mist plant",
    TaskCategory.inspection: "Inspect plant",
}


def _latest_action_date(logs: Iterable[LogRead | Log], action: str) -> date | None:
    for entry in logs:
        performed_at = getattr(entry, "performed_at", None)
        entry_action = getattr(entry, "action", "").lower()
        if entry_action == action and performed_at is not None:
            return performed_at.date()
    return None


def _interval_for_category(profile: PlantCareProfile, category: TaskCategory) -> int | None:
    field = _CATEGORY_FIELDS.get(category)
    if field is None:
        return None
    return getattr(profile, field, None)


def compute_next_due(
    *,
    profile: PlantCareProfile,
    category: TaskCategory,
    logs: Iterable[LogRead | Log],
    reference_date: date | None = None,
) -> date | None:
    """Determine the next due date for a care category."""

    interval = _interval_for_category(profile, category)
    if interval is None:
        return None
    action = _CATEGORY_ACTIONS.get(category)
    last_performed = _latest_action_date(logs, action) if action else None
    base = last_performed or reference_date or date.today()
    return base + timedelta(days=interval)


def sync_tasks_for_profile(
    session: Session,
    *,
    plant: Plant,
    profile: PlantCareProfile,
    logs: Iterable[LogRead | Log],
    reference_date: date | None = None,
) -> None:
    """Ensure care tasks exist for each configured interval."""

    today = reference_date or date.today()
    session.refresh(plant, attribute_names=["tasks"])
    existing_tasks = list(plant.tasks)
    for category, field in _CATEGORY_FIELDS.items():
        interval = getattr(profile, field, None)
        related = [task for task in existing_tasks if task.category == category]
        if interval is None:
            for task in related:
                if task.state == TaskState.pending:
                    task.state = TaskState.completed
                    task.completed_at = utcnow()
                    task.updated_at = utcnow()
                    session.add(task)
            continue
        next_due = compute_next_due(
            profile=profile,
            category=category,
            logs=logs,
            reference_date=today,
        )
        pending = [task for task in related if task.state == TaskState.pending]
        if pending:
            for task in pending:
                task.due_date = next_due
                task.updated_at = utcnow()
                session.add(task)
        else:
            session.add(
                Task(
                    plant_id=plant.id,
                    title=_CATEGORY_TITLES.get(category, "Care task"),
                    due_date=next_due,
                    category=category,
                )
            )
    session.commit()
    session.refresh(plant, attribute_names=["tasks"])


def schedule_follow_up_for_completion(
    session: Session,
    *,
    task: Task,
    profile: PlantCareProfile,
    logs: Iterable[LogRead | Log],
    completed_on: date | None = None,
) -> Task | None:
    """Schedule the next task for a completed care category."""

    if task.category not in _CATEGORY_FIELDS:
        return None
    next_due = compute_next_due(
        profile=profile,
        category=task.category,
        logs=logs,
        reference_date=completed_on,
    )
    if next_due is None:
        return None
    session.refresh(task, attribute_names=["plant"])
    plant = task.plant
    if plant is None:
        plant = session.get(Plant, task.plant_id)
    if plant is None:
        return None
    session.refresh(plant, attribute_names=["tasks"])
    pending = [
        existing
        for existing in plant.tasks
        if existing.category == task.category and existing.state == TaskState.pending
    ]
    if pending:
        upcoming = pending[0]
        upcoming.due_date = next_due
        upcoming.updated_at = utcnow()
        session.add(upcoming)
        session.commit()
        session.refresh(upcoming)
        return upcoming
    new_task = Task(
        plant_id=plant.id,
        title=_CATEGORY_TITLES.get(task.category, task.title),
        due_date=next_due,
        category=task.category,
    )
    session.add(new_task)
    session.commit()
    session.refresh(new_task)
    return new_task


def default_title(category: TaskCategory, fallback: str | None = None) -> str:
    """Return a user-facing title for the provided care category."""

    return _CATEGORY_TITLES.get(category, fallback or "Care task")
