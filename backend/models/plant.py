"""SQLModel definitions for plant entities."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PlantBase(SQLModel):
    name: str = Field(min_length=1, max_length=200)
    species: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    tags: List[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )


class Plant(PlantBase, table=True):
    __tablename__ = "plants"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    village_id: UUID = Field(foreign_key="villages.id", nullable=False, index=True)
    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)


class PlantCreate(PlantBase):
    village_id: UUID


class PlantRead(PlantBase):
    id: UUID
    village_id: UUID
    created_at: datetime
    updated_at: datetime


class PlantUpdate(SQLModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    species: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[List[str]] = None
    village_id: Optional[UUID] = None
