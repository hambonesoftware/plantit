from pydantic import BaseModel
from typing import List
from .common import TaskVM

class PlantBrief(BaseModel):
    id: int
    name: str
    species: str | None = None
    last_watered_human: str

class VillageVM(BaseModel):
    id: int
    name: str
    plants: List[PlantBrief]
    due_today: int
    overdue: int
