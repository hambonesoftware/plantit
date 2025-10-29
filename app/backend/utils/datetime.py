"""Timezone-aware datetime helpers."""
from __future__ import annotations

from datetime import UTC, datetime


def utc_now() -> datetime:
    """Return the current UTC time as a timezone-aware ``datetime``."""

    return datetime.now(UTC)


def ensure_utc(value: datetime | None) -> datetime | None:
    """Normalise ``value`` to a UTC ``datetime``.

    ``datetime.utcnow`` is deprecated in favour of timezone-aware timestamps.
    Existing data in the application was historically stored as naive UTC
    values, so this helper also upgrades naive datetimes by attaching the UTC
    timezone. ``None`` is returned unchanged.
    """

    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


__all__ = ["ensure_utc", "utc_now"]
