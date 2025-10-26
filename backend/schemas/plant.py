"""Pydantic models for plant API payloads."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from pydantic import BaseModel, Field, model_validator

from backend.models.plant import PlantKind

if TYPE_CHECKING:  # pragma: no cover - circular imports for type checking only
    from backend.schemas.log import LogRead
    from backend.schemas.photo import PhotoRead
    from backend.schemas.task import TaskRead


class PlantCareProfile(BaseModel):
    """Care cadence and notes for a plant."""

    watering_interval_days: int | None = Field(default=None, ge=1, le=365)
    feeding_interval_days: int | None = Field(default=None, ge=1, le=365)
    pruning_interval_days: int | None = Field(default=None, ge=1, le=365)
    misting_interval_days: int | None = Field(default=None, ge=1, le=365)
    notes: str | None = Field(default=None, max_length=2000)
    updated_at: datetime | None = None

    @model_validator(mode="after")
    def normalize_empty_values(self) -> "PlantCareProfile":
        """Convert empty strings to ``None`` for optional fields."""

        if self.notes is not None and self.notes.strip() == "":
            self.notes = None
        return self


class PlantBase(BaseModel):
    """Shared attributes for create/update operations."""

    village_id: int
    name: str = Field(min_length=1, max_length=120)
    species: str | None = Field(default=None, max_length=120)
    variety: str | None = Field(default=None, max_length=120)
    kind: PlantKind = Field(default=PlantKind.herb)
    acquired_on: date | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=1000)


class PlantCreate(PlantBase):
    """Payload used when creating a plant."""


class PlantUpdate(BaseModel):
    """Partial update payload for a plant."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    species: str | None = Field(default=None, max_length=120)
    variety: str | None = Field(default=None, max_length=120)
    kind: PlantKind | None = None
    acquired_on: date | None = None
    tags: list[str] | None = None
    notes: str | None = Field(default=None, max_length=1000)


class PlantMoveRequest(BaseModel):
    """Request payload to move a plant between villages."""

    destination_village_id: int


class PlantRead(BaseModel):
    """Serialized representation of a plant."""

    id: int
    village_id: int
    name: str
    species: str | None = None
    variety: str | None = None
    kind: PlantKind
    acquired_on: date | None = None
    tags: list[str] = Field(default_factory=list)
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class PlantOverviewMetrics(BaseModel):
    """Derived metrics displayed on the overview tab."""

    due_tasks: int = 0
    overdue_tasks: int = 0
    last_logged_at: datetime | None = None


class PlantDetail(PlantRead):
    """Full detail payload for plant view."""

    care_profile: PlantCareProfile
    hero_photo: "PhotoRead | None"
    photos: list["PhotoRead"]
    tasks: list["TaskRead"]
    logs: list["LogRead"]
    metrics: PlantOverviewMetrics


class PlantCareProfileUpdate(PlantCareProfile):
    """Update payload for care profile."""

    pass


class PlantTaskCreate(BaseModel):
    """Payload to schedule a new task for a plant."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    due_date: date | None = None
    category: str | None = Field(default=None, max_length=50)


__all__ = [
    "PlantBase",
    "PlantCareProfile",
    "PlantCareProfileUpdate",
    "PlantCreate",
    "PlantDetail",
    "PlantMoveRequest",
    "PlantOverviewMetrics",
    "PlantRead",
    "PlantTaskCreate",
    "PlantUpdate",
]

from backend.schemas.log import LogRead as _LogRead  # noqa: E402
from backend.schemas.photo import PhotoRead as _PhotoRead  # noqa: E402
from backend.schemas.task import TaskRead as _TaskRead  # noqa: E402

PlantDetail.model_rebuild(
    _types_namespace={
        "PhotoRead": _PhotoRead,
        "TaskRead": _TaskRead,
        "LogRead": _LogRead,
    }
)

PlantDetail.model_rebuild()
