"""Task domain model."""

from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

from backend.services.timeutils import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from backend.models.log import Log
    from backend.models.plant import Plant


class TaskState(str, Enum):
    """Lifecycle states for maintenance tasks."""

    pending = "pending"
    completed = "completed"
    skipped = "skipped"


class Task(SQLModel, table=True):
    """An actionable item associated with a plant."""

    __tablename__ = "tasks"

    id: int | None = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plants.id", index=True)
    title: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    due_date: date | None = Field(default=None, index=True)
    state: TaskState = Field(default=TaskState.pending, index=True)
    completed_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    plant: "Plant" = Relationship(back_populates="tasks")
    logs: list["Log"] = Relationship(back_populates="task")
