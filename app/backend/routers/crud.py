from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
from ..db import SessionLocal
from ..models import Village, Plant, Task

router = APIRouter()

class PlantCreate(BaseModel):
    village_id: int
    name: str
    species: str | None = None
    frequency_days: int = 3

@router.get("/villages")
def list_villages():
    with SessionLocal() as s:
        items = s.query(Village).order_by(Village.name.asc()).all()
        return [{"id":v.id, "name":v.name} for v in items]

@router.post("/plants")
def create_plant(data: PlantCreate):
    with SessionLocal() as s:
        v = s.get(Village, data.village_id)
        if not v:
            raise HTTPException(status_code=404, detail="Village not found")
        p = Plant(village_id=v.id, name=data.name, species=data.species, frequency_days=data.frequency_days, last_watered_at=datetime.utcnow())
        s.add(p); s.flush()
        # create next watering task
        due = datetime.utcnow() + timedelta(days=p.frequency_days)
        s.add(Task(plant_id=p.id, kind="water", due_date=due))
        s.commit()
        return {"id": p.id}

@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: int):
    with SessionLocal() as s:
        t = s.get(Task, task_id)
        if not t:
            raise HTTPException(status_code=404, detail="Task not found")
        t.done_at = datetime.utcnow()
        s.commit()
        return {"ok": True, "task_id": task_id}
