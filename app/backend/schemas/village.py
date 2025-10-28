from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class VillageBase(BaseModel):
    name: str
    note: Optional[str] = None


class VillageCreate(VillageBase):
    pass


class VillageUpdate(BaseModel):
    name: Optional[str] = None
    note: Optional[str] = None


class VillageRead(VillageBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
