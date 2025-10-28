from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class LogBase(BaseModel):
    plant_id: int
    kind: str
    note: Optional[str] = None
    ts: datetime = Field(default_factory=datetime.utcnow)


class LogCreate(LogBase):
    pass


class LogRead(LogBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
