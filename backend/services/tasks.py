"""Task orchestration helpers."""

from __future__ import annotations

from datetime import date

from sqlmodel import Session

from backend.models import Plant, Task
from backend.models.task import TaskState
from backend.repositories.logs import list_logs
from backend.repositories.tasks import (
    bulk_update_tasks,
    get_task,
    list_tasks,
    update_task,
)
from backend.schemas.log import LogRead
from backend.schemas.plant import PlantCareProfile
from backend.schemas.task import TaskBatchUpdate, TaskPlantSummary, TaskRead, TaskUpdate
from backend.services import cadence


def serialize_task(task: Task) -> TaskRead:
    plant_summary = None
    if task.plant is not None:
        plant_summary = TaskPlantSummary(id=task.plant.id, name=task.plant.name)
    return TaskRead(
        id=task.id,
        plant_id=task.plant_id,
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        state=task.state,
        category=task.category,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        plant=plant_summary,
    )


def list_for_view(
    session: Session,
    *,
    state: TaskState | None = None,
    category=None,
    plant_id: int | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    search: str | None = None,
) -> list[TaskRead]:
    tasks = list_tasks(
        session,
        plant_id=plant_id,
        state=state,
        category=category,
        include_completed=True,
        due_before=due_before,
        due_after=due_after,
        search=search,
        with_plant=True,
    )
    return [serialize_task(task) for task in tasks]


def _load_profile(session: Session, plant: Plant) -> PlantCareProfile:
    return PlantCareProfile.model_validate(plant.care_profile or {})


def _load_logs(session: Session, plant_id: int) -> list[LogRead]:
    logs = list_logs(session, plant_id=plant_id, limit=100)
    return [LogRead.model_validate(log.model_dump()) for log in logs]


def apply_update(session: Session, task: Task, payload: TaskUpdate) -> Task:
    previous_state = task.state
    updated = update_task(session, task, payload)
    if previous_state != TaskState.completed and updated.state == TaskState.completed:
        session.refresh(updated, attribute_names=["plant"])
        plant = updated.plant or session.get(Plant, updated.plant_id)
        if plant is not None:
            profile = _load_profile(session, plant)
            logs = _load_logs(session, plant.id)
            cadence.schedule_follow_up_for_completion(
                session,
                task=updated,
                profile=profile,
                logs=logs,
                completed_on=updated.completed_at.date() if updated.completed_at else date.today(),
            )
    return updated


def apply_batch_update(session: Session, payload: TaskBatchUpdate) -> list[Task]:
    tasks = bulk_update_tasks(session, payload)
    for task in tasks:
        if task.state == TaskState.completed:
            session.refresh(task, attribute_names=["plant"])
            plant = task.plant or session.get(Plant, task.plant_id)
            if plant is None:
                continue
            profile = _load_profile(session, plant)
            logs = _load_logs(session, plant.id)
            cadence.schedule_follow_up_for_completion(
                session,
                task=task,
                profile=profile,
                logs=logs,
                completed_on=task.completed_at.date() if task.completed_at else date.today(),
            )
    return tasks


def mark_complete(session: Session, task_id: int) -> Task:
    task = get_task(session, task_id)
    if task is None:
        raise ValueError("Task not found")
    return apply_update(session, task, TaskUpdate(state=TaskState.completed))
