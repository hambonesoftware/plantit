"""Schemas for plant history logs."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LogCreate(BaseModel):
    """Payload to create a new log entry."""

    action: str = Field(min_length=1, max_length=120)
    notes: str | None = Field(default=None, max_length=1000)
    performed_at: datetime | None = None
    task_id: int | None = None


class LogRead(BaseModel):
    """Serialized log entry."""

    id: int
    plant_id: int
    task_id: int | None = None
    action: str
    notes: str | None = None
    performed_at: datetime


__all__ = ["LogCreate", "LogRead"]
