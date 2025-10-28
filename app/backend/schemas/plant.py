from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PlantBase(BaseModel):
    village_id: int
    name: str
    species: Optional[str] = None
    frequency_days: int = Field(default=3, ge=1)
    photo_path: Optional[str] = None
    last_watered_at: Optional[datetime] = None


class PlantCreate(PlantBase):
    pass


class PlantUpdate(BaseModel):
    village_id: Optional[int] = None
    name: Optional[str] = None
    species: Optional[str] = None
    frequency_days: Optional[int] = Field(default=None, ge=1)
    photo_path: Optional[str] = None
    last_watered_at: Optional[datetime] = None


class PlantRead(PlantBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
