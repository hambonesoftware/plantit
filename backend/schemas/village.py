"""Schemas for village API payloads."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator


class VillageBase(BaseModel):
    """Shared attributes for village create/update operations."""

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    timezone: str = Field(default="UTC", max_length=64)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        """Convert empty descriptions to ``None``."""

        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        """Ensure the timezone is a valid IANA identifier."""

        normalized = value.strip()
        if not normalized:
            raise ValueError("Timezone is required.")
        try:
            ZoneInfo(normalized)
        except ZoneInfoNotFoundError as exc:  # pragma: no cover - specific exception type
            raise ValueError("Invalid timezone.") from exc
        except Exception as exc:  # pragma: no cover - fallback for platforms without tz data
            raise ValueError("Invalid timezone.") from exc
        return normalized


class VillageCreate(VillageBase):
    """Payload for creating a village."""

    pass


class VillageUpdate(BaseModel):
    """Partial update payload for a village."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    timezone: str | None = Field(default=None, max_length=64)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Timezone is required.")
        try:
            ZoneInfo(normalized)
        except ZoneInfoNotFoundError as exc:  # pragma: no cover
            raise ValueError("Invalid timezone.") from exc
        except Exception as exc:  # pragma: no cover
            raise ValueError("Invalid timezone.") from exc
        return normalized


class VillageRead(VillageBase):
    """Serialized representation of a village."""

    id: int
    created_at: datetime
    updated_at: datetime


__all__ = [
    "VillageBase",
    "VillageCreate",
    "VillageRead",
    "VillageUpdate",
]
