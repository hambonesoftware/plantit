from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

TaskKind = Literal['water', 'fertilize', 'repot']


class TaskBase(BaseModel):
    plant_id: int
    kind: TaskKind
    due_date: datetime
    done_at: Optional[datetime] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    plant_id: Optional[int] = None
    kind: Optional[TaskKind] = None
    due_date: Optional[datetime] = None
    done_at: Optional[datetime] = None


class TaskRead(TaskBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
