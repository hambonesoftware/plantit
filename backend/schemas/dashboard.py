"""Schemas for dashboard endpoint."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class VillageSummaryRead(BaseModel):
    id: int
    name: str
    plant_count: int
    due_today: int
    overdue: int
    last_watered_days: int | None
    cover_photo: str | None


class EntityRef(BaseModel):
    id: int
    name: str


class TaskSummaryRead(BaseModel):
    id: int
    title: str
    due_date: date | None
    plant: EntityRef
    village: EntityRef


class CalendarBucketRead(BaseModel):
    date: date
    count: int


class DashboardResponse(BaseModel):
    villages: list[VillageSummaryRead]
    today: list[TaskSummaryRead]
    calendar: list[CalendarBucketRead]
