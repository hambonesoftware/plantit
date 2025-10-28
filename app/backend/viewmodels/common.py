from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional

class TaskVM(BaseModel):
    id: int
    plant_id: int
    kind: str
    due_date: datetime
    overdue_days: int
    plant_name: str
    village_name: str

class VillageCardVM(BaseModel):
    id: int
    name: str
    due_today: int
    overdue: int
    last_watered_human: str

class CalendarDot(BaseModel):
    day: int
    count: int

class CalendarVM(BaseModel):
    year: int
    month: int
    dots: List[CalendarDot]
