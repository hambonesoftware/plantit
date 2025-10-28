from pydantic import BaseModel
from typing import List
from .common import VillageCardVM, TaskVM, CalendarVM

class DashboardVM(BaseModel):
    villages: List[VillageCardVM]
    today: List[TaskVM]
    calendar: CalendarVM
