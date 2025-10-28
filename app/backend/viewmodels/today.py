from pydantic import BaseModel
from typing import List
from .common import TaskVM

class TodayVM(BaseModel):
    today: List[TaskVM]
