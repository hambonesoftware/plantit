"""Schemas for task management endpoints."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from backend.models.task import TaskCategory, TaskState


class TaskPlantSummary(BaseModel):
    """Minimal plant information attached to a task."""

    id: int
    name: str


class TaskCreate(BaseModel):
    """Payload used to create a task."""

    plant_id: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    due_date: date | None = None
    category: TaskCategory = TaskCategory.custom


class TaskUpdate(BaseModel):
    """Partial update payload for a task."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    due_date: date | None = None
    state: TaskState | None = None
    category: TaskCategory | None = None


class TaskBatchUpdate(BaseModel):
    """Batch operation payload for multiple tasks."""

    task_ids: list[int] = Field(min_length=1)
    state: TaskState | None = None
    due_date: date | None = None

    @field_validator("task_ids")
    @classmethod
    def ensure_unique_ids(cls, value: list[int]) -> list[int]:
        """Prevent duplicate task identifiers."""

        return list(dict.fromkeys(value))


class TaskRead(BaseModel):
    """Serialized task object."""

    id: int
    plant_id: int
    title: str
    description: str | None = None
    due_date: date | None = None
    state: TaskState
    category: TaskCategory
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    plant: TaskPlantSummary | None = None


__all__ = [
    "TaskBatchUpdate",
    "TaskCreate",
    "TaskPlantSummary",
    "TaskRead",
    "TaskUpdate",
]
