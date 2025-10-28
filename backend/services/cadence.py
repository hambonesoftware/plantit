"""Cadence utilities for recurring plant care tasks."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Sequence

from backend.models import CareCadenceType, CareProfile


def _ensure_weekdays(days: Sequence[int]) -> list[int]:
    normalized = sorted({int(day) % 7 for day in days})
    if not normalized:
        raise ValueError("Weekly cadence requires at least one weekday")
    return normalized


def first_due_on_or_after(profile: CareProfile, reference: date) -> date:
    """Return the first due date on or after the reference date."""

    if profile.cadence_type == CareCadenceType.INTERVAL:
        interval = profile.interval_days or 1
        start = profile.start_date
        if reference <= start:
            return start
        elapsed = (reference - start).days
        remainder = elapsed % interval
        if remainder == 0:
            return reference
        return reference + timedelta(days=interval - remainder)

    days = _ensure_weekdays(profile.weekly_days)
    ref_weekday = reference.weekday()
    deltas = sorted((day - ref_weekday) % 7 for day in days)
    return reference + timedelta(days=deltas[0])


def next_due_after(profile: CareProfile, reference: date) -> date:
    """Return the next due date strictly after the reference date."""

    if profile.cadence_type == CareCadenceType.INTERVAL:
        interval = profile.interval_days or 1
        return reference + timedelta(days=interval)

    days = _ensure_weekdays(profile.weekly_days)
    ref_weekday = reference.weekday()
    deltas = []
    for day in days:
        delta = (day - ref_weekday) % 7
        if delta == 0:
            delta = 7
        deltas.append(delta)
    return reference + timedelta(days=min(deltas))
