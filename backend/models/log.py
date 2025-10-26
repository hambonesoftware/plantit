"""Log domain model."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from backend.services.timeutils import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from backend.models.plant import Plant
    from backend.models.task import Task


class Log(SQLModel, table=True):
    """A historical record for a plant."""

    __tablename__ = "logs"

    id: int | None = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plants.id", index=True)
    task_id: int | None = Field(default=None, foreign_key="tasks.id")
    action: str = Field(max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    performed_at: datetime = Field(default_factory=utcnow, index=True)

    plant: "Plant" = Relationship(back_populates="logs")
    task: Optional["Task"] = Relationship(back_populates="logs")
