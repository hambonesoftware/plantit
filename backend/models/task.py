"""SQLModel definitions for tasks derived from care profiles."""
from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TaskStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class TaskBase(SQLModel):
    title: str = Field(min_length=1, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    due_date: date


class Task(TaskBase, table=True):
    __tablename__ = "tasks"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    plant_id: UUID = Field(foreign_key="plants.id", nullable=False, index=True)
    care_profile_id: Optional[UUID] = Field(
        default=None,
        foreign_key="care_profiles.id",
        index=True,
        nullable=True,
    )
    status: TaskStatus = Field(default=TaskStatus.PENDING, nullable=False)
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)


class TaskCreate(TaskBase):
    plant_id: UUID
    care_profile_id: Optional[UUID] = None


class TaskRead(TaskBase):
    id: UUID
    plant_id: UUID
    care_profile_id: Optional[UUID]
    status: TaskStatus
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class TaskUpdate(SQLModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    due_date: Optional[date] = None
    status: Optional[TaskStatus] = None

