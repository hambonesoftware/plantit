"""Schemas for village API payloads."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class VillageBase(BaseModel):
    """Shared attributes for village create/update operations."""

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        """Convert empty descriptions to ``None``."""

        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class VillageCreate(VillageBase):
    """Payload for creating a village."""

    pass


class VillageUpdate(BaseModel):
    """Partial update payload for a village."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

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
