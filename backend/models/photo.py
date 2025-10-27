"""SQLModel definitions for plant photos."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Photo(SQLModel, table=True):
    __tablename__ = "photos"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    plant_id: UUID = Field(foreign_key="plants.id", nullable=False, index=True)
    original_path: str = Field(max_length=500, nullable=False)
    thumbnail_path: str = Field(max_length=500, nullable=False)
    content_type: str = Field(max_length=100, nullable=False)
    width: int = Field(nullable=False)
    height: int = Field(nullable=False)
    file_size: int = Field(nullable=False, ge=0)
    created_at: datetime = Field(default_factory=_utcnow, nullable=False)


class PhotoRead(SQLModel):
    id: UUID
    plant_id: UUID
    original_path: str
    thumbnail_path: str
    content_type: str
    width: int
    height: int
    file_size: int
    created_at: datetime
    original_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
