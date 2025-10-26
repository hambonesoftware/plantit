"""Task management endpoints."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from backend.database import get_session
from backend.models.task import TaskCategory, TaskState
from backend.repositories.tasks import get_task
from backend.schemas.task import TaskBatchUpdate, TaskRead, TaskUpdate
from backend.services.tasks import apply_batch_update, apply_update, list_for_view, serialize_task

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _parse_state(value: str | None) -> TaskState | None:
    if value is None:
        return None
    try:
        return TaskState(value)
    except ValueError:
        return None


def _parse_category(value: str | None) -> TaskCategory | None:
    if value is None:
        return None
    try:
        return TaskCategory(value)
    except ValueError:
        return None


def _parse_date(value: str | None) -> date | None:
    if value is None:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


@router.get("", response_model=list[TaskRead])
def list_tasks(
    *,
    session: Session = Depends(get_session),
    state: str | None = Query(default=None),
    category: str | None = Query(default=None),
    plant_id: int | None = Query(default=None),
    due_before: str | None = Query(default=None),
    due_after: str | None = Query(default=None),
    search: str | None = Query(default=None),
) -> list[TaskRead]:
    return list_for_view(
        session,
        state=_parse_state(state),
        category=_parse_category(category),
        plant_id=plant_id,
        due_before=_parse_date(due_before),
        due_after=_parse_date(due_after),
        search=search,
    )


@router.patch("/{task_id}", response_model=TaskRead)
def update_task_endpoint(
    task_id: int,
    payload: TaskUpdate,
    session: Session = Depends(get_session),
) -> TaskRead:
    task = get_task(session, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Task not found.")
    updated = apply_update(session, task, payload)
    session.refresh(updated, attribute_names=["plant"])
    return serialize_task(updated)


@router.post("/batch", response_model=list[TaskRead])
def batch_update_endpoint(
    payload: TaskBatchUpdate,
    session: Session = Depends(get_session),
) -> list[TaskRead]:
    tasks = apply_batch_update(session, payload)
    for task in tasks:
        session.refresh(task, attribute_names=["plant"])
    return [serialize_task(task) for task in tasks]
