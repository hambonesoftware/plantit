"""Plant domain model."""

from datetime import date, datetime
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Column
from sqlmodel import Field, Relationship, SQLModel

from backend.services.timeutils import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from backend.models.log import Log
    from backend.models.photo import Photo
    from backend.models.task import Task
    from backend.models.village import Village


class PlantKind(str, Enum):
    """Supported plant categories."""

    vegetable = "vegetable"
    herb = "herb"
    flower = "flower"
    succulent = "succulent"
    tree = "tree"


class Plant(SQLModel, table=True):
    """A single plant instance tracked by the system."""

    __tablename__ = "plants"

    id: int | None = Field(default=None, primary_key=True)
    village_id: int = Field(foreign_key="villages.id", index=True)
    name: str = Field(max_length=120)
    species: str = Field(max_length=120)
    variety: str | None = Field(default=None, max_length=120)
    kind: PlantKind = Field(default=PlantKind.herb)
    acquired_on: date | None = Field(default=None, index=True)
    tags: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    notes: str | None = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    village: "Village" = Relationship(back_populates="plants")
    tasks: list["Task"] = Relationship(back_populates="plant")
    logs: list["Log"] = Relationship(back_populates="plant")
    photos: list["Photo"] = Relationship(back_populates="plant")
