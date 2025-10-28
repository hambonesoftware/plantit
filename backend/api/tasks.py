"""API routes for plant care tasks."""
from __future__ import annotations

from datetime import date
from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlmodel import Session

from backend.db import get_session
from backend.models import TaskCreate, TaskRead, TaskStatus, TaskUpdate
from backend.repositories.tasks import TaskRepository
from backend.utils.etag import compute_etag

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

HeaderETag = Annotated[Optional[str], Header(alias="If-None-Match")]


def _normalize_etag(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip('"')


@router.get("/", response_model=List[TaskRead])
def list_tasks(
    *,
    session: Session = Depends(get_session),
    plant_id: Optional[UUID] = Query(default=None),
    status_filter: Optional[TaskStatus] = Query(default=None, alias="status"),
    due_before: Optional[date] = Query(default=None),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = TaskRepository(session)
    tasks = repository.list(
        plant_id=plant_id,
        status_filter=status_filter,
        due_before=due_before,
    )
    payload = [TaskRead.model_validate(task) for task in tasks]
    etag = compute_etag([item.model_dump() for item in payload])
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    *,
    payload: TaskCreate,
    session: Session = Depends(get_session),
):
    repository = TaskRepository(session)
    task = repository.create(payload)
    return TaskRead.model_validate(task)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: UUID,
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = TaskRepository(session)
    task = repository.get(task_id)
    payload = TaskRead.model_validate(task)
    etag = compute_etag(payload.model_dump())
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: UUID,
    *,
    payload: TaskUpdate,
    session: Session = Depends(get_session),
):
    repository = TaskRepository(session)
    task = repository.get(task_id)
    updated = repository.update(task, payload)
    return TaskRead.model_validate(updated)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: UUID,
    *,
    session: Session = Depends(get_session),
):
    repository = TaskRepository(session)
    task = repository.get(task_id)
    repository.delete(task)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
