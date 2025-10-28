from datetime import datetime, timedelta
from sqlalchemy import func, extract
from sqlalchemy.orm import Session
from ..models import Village, Plant, Task, Log
from ..viewmodels.common import VillageCardVM, TaskVM, CalendarVM, CalendarDot
from ..viewmodels.dashboard import DashboardVM
from ..viewmodels.village import VillageVM, PlantBrief
from ..viewmodels.plant import PlantVM, LogItem
from ..viewmodels.today import TodayVM

def human_since(dt: datetime | None) -> str:
    if not dt:
        return "—"
    delta = datetime.utcnow() - dt
    days = delta.days
    if days <= 0:
        return "today"
    if days == 1:
        return "1 day ago"
    return f"{days} days ago"

def build_village_card(session: Session, v: Village) -> VillageCardVM:
    today = datetime.utcnow()
    due_today = session.query(Task).join(Plant).filter(Plant.village_id==v.id, Task.done_at==None, func.date(Task.due_date) <= func.date(today)).count()
    overdue = session.query(Task).join(Plant).filter(Plant.village_id==v.id, Task.done_at==None, func.date(Task.due_date) < func.date(today)).count()
    # last watered among plants
    last = None
    for p in v.plants:
        if p.last_watered_at and (last is None or p.last_watered_at > last):
            last = p.last_watered_at
    return VillageCardVM(id=v.id, name=v.name, due_today=due_today, overdue=overdue, last_watered_human=human_since(last))

def build_today_list(session: Session) -> list[TaskVM]:
    today = datetime.utcnow()
    q = (session.query(Task, Plant, Village)
        .join(Plant, Task.plant_id==Plant.id)
        .join(Village, Plant.village_id==Village.id)
        .filter(Task.done_at==None, func.date(Task.due_date) <= func.date(today))
        .order_by(Task.due_date.asc()))
    out: list[TaskVM] = []
    for t, p, v in q:
        overdue_days = max(0, (today.date() - t.due_date.date()).days)
        out.append(TaskVM(
            id=t.id, plant_id=p.id, kind=t.kind, due_date=t.due_date,
            overdue_days=overdue_days, plant_name=p.name, village_name=v.name
        ))
    return out

def build_calendar(session: Session) -> CalendarVM:
    now = datetime.utcnow()
    # count tasks per day for current month
    q = (session.query(func.date(Task.due_date), func.count())
         .filter(extract('month', Task.due_date)==now.month, extract('year', Task.due_date)==now.year)
         .group_by(func.date(Task.due_date)))
    dots = []
    for day_str, cnt in q:
        # day_str may be 'YYYY-MM-DD' str for sqlite
        day = int(str(day_str).split('-')[-1])
        dots.append(CalendarDot(day=day, count=cnt))
    return CalendarVM(year=now.year, month=now.month, dots=dots)

def build_dashboard(session: Session) -> DashboardVM:
    villages = session.query(Village).order_by(Village.name.asc()).all()
    cards = [build_village_card(session, v) for v in villages]
    today_list = build_today_list(session)
    calendar = build_calendar(session)
    return DashboardVM(villages=cards, today=today_list, calendar=calendar)

def build_village(session: Session, village_id: int) -> VillageVM:
    v = session.get(Village, village_id)
    if not v:
        raise ValueError("Village not found")
    plants = []
    for p in v.plants:
        plants.append(PlantBrief(id=p.id, name=p.name, species=p.species, last_watered_human=human_since(p.last_watered_at)))
    card = build_village_card(session, v)
    return VillageVM(id=v.id, name=v.name, plants=plants, due_today=card.due_today, overdue=card.overdue)

def build_plant(session: Session, plant_id: int) -> PlantVM:
    p = session.get(Plant, plant_id)
    if not p:
        raise ValueError("Plant not found")
    v = session.get(Village, p.village_id)
    logs = [LogItem(ts=l.ts, kind=l.kind, note=l.note) for l in p.logs]
    return PlantVM(
        id=p.id, village_id=p.village_id, village_name=v.name if v else "",
        name=p.name, species=p.species, last_watered_human=human_since(p.last_watered_at),
        frequency_days=p.frequency_days, logs=logs
    )

def build_today(session: Session) -> TodayVM:
    return TodayVM(today=build_today_list(session))
