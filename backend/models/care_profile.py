"""SQLModel definitions for plant care profiles."""
from __future__ import annotations

from datetime import date, datetime, timezone
from enum import Enum
from typing import List, Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CareCadenceType(str, Enum):
    """Supported cadence types for recurring plant care."""

    INTERVAL = "interval"
    WEEKLY = "weekly"


class CareProfileBase(SQLModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    cadence_type: CareCadenceType
    interval_days: Optional[int] = Field(default=None, ge=1, le=365)
    weekly_days: List[int] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )
    start_date: date = Field(default_factory=date.today)

    @classmethod
    def _normalize_weekly_days(cls, values: List[int]) -> List[int]:
        normalized = sorted({int(day) % 7 for day in values})
        return normalized

    @classmethod
    def model_validate(cls, *args, **kwargs):  # type: ignore[override]
        model = super().model_validate(*args, **kwargs)
        model.weekly_days = cls._normalize_weekly_days(model.weekly_days)
        if model.cadence_type == CareCadenceType.INTERVAL and not model.interval_days:
            raise ValueError("interval_days is required for interval cadence")
        if model.cadence_type == CareCadenceType.WEEKLY and not model.weekly_days:
            raise ValueError("weekly_days is required for weekly cadence")
        return model


class CareProfile(CareProfileBase, table=True):
    __tablename__ = "care_profiles"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    plant_id: UUID = Field(foreign_key="plants.id", nullable=False, index=True)
    created_at: datetime = Field(default_factory=_utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=_utcnow, nullable=False)


class CareProfileCreate(CareProfileBase):
    plant_id: UUID


class CareProfileRead(CareProfileBase):
    id: UUID
    plant_id: UUID
    created_at: datetime
    updated_at: datetime


class CareProfileUpdate(SQLModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    cadence_type: Optional[CareCadenceType] = None
    interval_days: Optional[int] = Field(default=None, ge=1, le=365)
    weekly_days: Optional[List[int]] = None
    start_date: Optional[date] = None

    @classmethod
    def model_validate(cls, *args, **kwargs):  # type: ignore[override]
        model = super().model_validate(*args, **kwargs)
        if model.weekly_days is not None:
            model.weekly_days = CareProfileBase._normalize_weekly_days(model.weekly_days)
        return model
