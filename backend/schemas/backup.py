"""Schemas for export and import operations."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class ExportScope(str, Enum):
    """Supported scopes for export bundles."""

    all = "all"
    village = "village"
    plant = "plant"


class ExportMeta(BaseModel):
    """Metadata describing an export bundle."""

    version: str = "1.0"
    exported_at: datetime
    scope: ExportScope
    filter: dict[str, int | None] = Field(default_factory=dict)


class VillageRecord(BaseModel):
    """Serializable representation of a village."""

    id: int
    name: str
    description: str | None = None
    timezone: str
    created_at: datetime
    updated_at: datetime


class PlantRecord(BaseModel):
    """Serializable representation of a plant."""

    id: int
    village_id: int
    name: str
    species: str
    variety: str | None = None
    kind: str
    acquired_on: date | None = None
    tags: list[str] = Field(default_factory=list)
    care_profile: dict = Field(default_factory=dict)
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class TaskRecord(BaseModel):
    """Serializable representation of a task."""

    id: int
    plant_id: int
    title: str
    description: str | None = None
    due_date: date | None = None
    state: str
    category: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class LogRecord(BaseModel):
    """Serializable representation of a log entry."""

    id: int
    plant_id: int
    task_id: int | None = None
    action: str
    notes: str | None = None
    performed_at: datetime


class PhotoRecord(BaseModel):
    """Serializable representation of a photo."""

    id: int
    plant_id: int
    filename: str
    file_path: str
    thumbnail_path: str
    content_type: str
    size_bytes: int
    width: int
    height: int
    caption: str | None = None
    captured_at: datetime
    uploaded_at: datetime


class MediaManifestEntry(BaseModel):
    """A single media file reference included in an export."""

    file_path: str
    thumbnail_path: str
    size_bytes: int
    exists: bool


class ExportBundle(BaseModel):
    """The full payload representing an export bundle."""

    meta: ExportMeta
    villages: list[VillageRecord]
    plants: list[PlantRecord]
    tasks: list[TaskRecord]
    logs: list[LogRecord]
    photos: list[PhotoRecord]
    media: list[MediaManifestEntry] = Field(default_factory=list)


class ImportSummary(BaseModel):
    """Report generated after importing a bundle."""

    status: Literal["success", "partial"]
    created: dict[str, int]
    updated: dict[str, int]
    conflicts: list[str] = Field(default_factory=list)
    id_map: dict[str, dict[int, int]] = Field(default_factory=dict)
