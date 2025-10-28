from datetime import datetime, timedelta
from ..db import SessionLocal
from ..models import Village, Plant, Task, Log

def seed(session: SessionLocal):
    # Villages
    v1 = Village(name="Sunroom")
    v2 = Village(name="Kitchen Window")
    v3 = Village(name="Greenhouse A")
    session.add_all([v1, v2, v3])
    session.flush()

    # Plants
    p1 = Plant(village_id=v1.id, name="Water Monstera", species="Monstera deliciosa", last_watered_at=datetime.utcnow()-timedelta(days=2), frequency_days=2)
    p2 = Plant(village_id=v2.id, name="Fiddle Leaf", species="Ficus lyrata", last_watered_at=datetime.utcnow()-timedelta(days=3), frequency_days=3)
    p3 = Plant(village_id=v3.id, name="Snake Plant", species="Sansevieria", last_watered_at=datetime.utcnow()-timedelta(days=5), frequency_days=7)
    session.add_all([p1,p2,p3])
    session.flush()

    # Tasks
    t1 = Task(plant_id=p1.id, kind="water", due_date=datetime.utcnow(), done_at=None)
    t2 = Task(plant_id=p2.id, kind="fertilize", due_date=datetime.utcnow()-timedelta(days=1), done_at=None)
    t3 = Task(plant_id=p3.id, kind="repot", due_date=datetime.utcnow()+timedelta(days=5), done_at=None)
    session.add_all([t1,t2,t3])

    # Logs
    session.add_all([
        Log(plant_id=p1.id, kind="water", note="Good soak"),
        Log(plant_id=p2.id, kind="water", note="Light water"),
        Log(plant_id=p3.id, kind="water", note=""),
    ])
