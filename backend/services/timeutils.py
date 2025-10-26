"""Time utility helpers for the backend."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Return the current UTC time with timezone awareness."""

    return datetime.now(timezone.utc)
