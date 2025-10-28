from pydantic import BaseModel
from typing import List
from datetime import datetime

class LogItem(BaseModel):
    ts: datetime
    kind: str
    note: str | None = None

class PlantVM(BaseModel):
    id: int
    village_id: int
    village_name: str
    name: str
    species: str | None = None
    last_watered_human: str
    frequency_days: int
    logs: List[LogItem]
