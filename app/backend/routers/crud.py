from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Iterable, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..db import SessionLocal
from ..models import Log, Plant, Task, Village
from ..schemas import (
    LogCreate,
    LogRead,
    PlantCreate,
    PlantRead,
    PlantUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    VillageCreate,
    VillageRead,
    VillageUpdate,
)
from ..services.vm_builders import (
    build_dashboard,
    build_plant,
    build_today,
    build_village,
)
from ..services.import_export import ImportRequest, export_bundle, import_bundle

router = APIRouter()


def get_session() -> Iterable[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _get_or_404(session: Session, model: type, object_id: int, label: str):
    instance = session.get(model, object_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return instance


# Villages -----------------------------------------------------------------


@router.get("/villages", response_model=list[VillageRead])
def list_villages(session: Session = Depends(get_session)) -> list[VillageRead]:
    villages = session.query(Village).order_by(Village.name.asc()).all()
    return [VillageRead.model_validate(v) for v in villages]


@router.post("/villages", response_model=VillageRead, status_code=status.HTTP_201_CREATED)
def create_village(payload: VillageCreate, session: Session = Depends(get_session)) -> VillageRead:
    village = Village(name=payload.name, note=payload.note)
    session.add(village)
    session.commit()
    session.refresh(village)
    return VillageRead.model_validate(village)


@router.get("/villages/{village_id}", response_model=VillageRead)
def get_village(village_id: int, session: Session = Depends(get_session)) -> VillageRead:
    village = _get_or_404(session, Village, village_id, "Village")
    return VillageRead.model_validate(village)


@router.put("/villages/{village_id}", response_model=VillageRead)
def update_village(village_id: int, payload: VillageUpdate, session: Session = Depends(get_session)) -> VillageRead:
    village = _get_or_404(session, Village, village_id, "Village")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(village, field, value)
    session.commit()
    session.refresh(village)
    return VillageRead.model_validate(village)


@router.delete(
    "/villages/{village_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete_village(village_id: int, session: Session = Depends(get_session)) -> Response:
    village = _get_or_404(session, Village, village_id, "Village")
    session.delete(village)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Plants --------------------------------------------------------------------


@router.get("/plants", response_model=list[PlantRead])
def list_plants(
    session: Session = Depends(get_session),
    village_id: int | None = Query(default=None, description="Filter plants by village"),
) -> list[PlantRead]:
    query = session.query(Plant)
    if village_id is not None:
        query = query.filter(Plant.village_id == village_id)
    plants = query.order_by(Plant.name.asc()).all()
    return [PlantRead.model_validate(p) for p in plants]


@router.post("/plants", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(payload: PlantCreate, session: Session = Depends(get_session)) -> PlantRead:
    _get_or_404(session, Village, payload.village_id, "Village")
    plant = Plant(
        village_id=payload.village_id,
        name=payload.name,
        species=payload.species,
        frequency_days=payload.frequency_days,
        photo_path=payload.photo_path,
        last_watered_at=payload.last_watered_at or datetime.utcnow(),
    )
    session.add(plant)
    session.flush()
    # create default watering task aligned with frequency
    due_date = datetime.utcnow() + timedelta(days=plant.frequency_days)
    session.add(Task(plant_id=plant.id, kind="water", due_date=due_date))
    session.commit()
    session.refresh(plant)
    return PlantRead.model_validate(plant)


@router.get("/plants/{plant_id}", response_model=PlantRead)
def get_plant(plant_id: int, session: Session = Depends(get_session)) -> PlantRead:
    plant = _get_or_404(session, Plant, plant_id, "Plant")
    return PlantRead.model_validate(plant)


@router.put("/plants/{plant_id}", response_model=PlantRead)
def update_plant(plant_id: int, payload: PlantUpdate, session: Session = Depends(get_session)) -> PlantRead:
    plant = _get_or_404(session, Plant, plant_id, "Plant")
    if payload.village_id is not None:
        _get_or_404(session, Village, payload.village_id, "Village")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plant, field, value)
    session.commit()
    session.refresh(plant)
    return PlantRead.model_validate(plant)


@router.delete(
    "/plants/{plant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete_plant(plant_id: int, session: Session = Depends(get_session)) -> Response:
    plant = _get_or_404(session, Plant, plant_id, "Plant")
    session.delete(plant)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Tasks ---------------------------------------------------------------------


TaskDueFilter = Literal['today', 'overdue']


class PlantActionPayload(BaseModel):
    note: str | None = None


@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(
    session: Session = Depends(get_session),
    plant_id: int | None = Query(default=None, description="Filter tasks by plant"),
    due: TaskDueFilter | None = Query(default=None, description="Filter by due status"),
) -> list[TaskRead]:
    query = session.query(Task)
    if plant_id is not None:
        query = query.filter(Task.plant_id == plant_id)
    today = date.today()
    if due == 'today':
        query = query.filter(Task.done_at.is_(None), func.date(Task.due_date) <= today)
    elif due == 'overdue':
        query = query.filter(Task.done_at.is_(None), func.date(Task.due_date) < today)
    tasks = query.order_by(Task.due_date.asc()).all()
    return [TaskRead.model_validate(t) for t in tasks]


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, session: Session = Depends(get_session)) -> TaskRead:
    _get_or_404(session, Plant, payload.plant_id, "Plant")
    task = Task(
        plant_id=payload.plant_id,
        kind=payload.kind,
        due_date=payload.due_date,
        done_at=payload.done_at,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return TaskRead.model_validate(task)


@router.get("/tasks/{task_id}", response_model=TaskRead)
def get_task(task_id: int, session: Session = Depends(get_session)) -> TaskRead:
    task = _get_or_404(session, Task, task_id, "Task")
    return TaskRead.model_validate(task)


@router.put("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, session: Session = Depends(get_session)) -> TaskRead:
    task = _get_or_404(session, Task, task_id, "Task")
    if payload.plant_id is not None:
        _get_or_404(session, Plant, payload.plant_id, "Plant")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    session.commit()
    session.refresh(task)
    return TaskRead.model_validate(task)


@router.delete(
    "/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete_task(task_id: int, session: Session = Depends(get_session)) -> Response:
    task = _get_or_404(session, Task, task_id, "Task")
    session.delete(task)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tasks/{task_id}/complete")
def complete_task(task_id: int, session: Session = Depends(get_session)) -> dict[str, object]:
    task = _get_or_404(session, Task, task_id, "Task")
    task.done_at = datetime.utcnow()
    session.commit()
    session.refresh(task)
    return {"ok": True, "task": TaskRead.model_validate(task).model_dump()}


@router.post("/plants/{plant_id}/water")
def water_plant(
    plant_id: int,
    payload: PlantActionPayload | None = None,
    session: Session = Depends(get_session),
) -> dict[str, object]:
    plant = _get_or_404(session, Plant, plant_id, "Plant")
    note = payload.note if payload else None
    now = datetime.utcnow()
    plant.last_watered_at = now
    session.add(
        Log(
            plant_id=plant_id,
            kind="water",
            note=note,
            ts=now,
        )
    )

    pending = (
        session.query(Task)
        .filter(Task.plant_id == plant_id, Task.kind == "water", Task.done_at.is_(None))
        .order_by(Task.due_date.asc())
        .all()
    )
    next_task = None
    for task in pending:
        if task.due_date <= now:
            task.done_at = now
        elif not next_task:
            next_task = task

    if next_task:
        next_task.due_date = now + timedelta(days=plant.frequency_days)
    else:
        session.add(
            Task(
                plant_id=plant_id,
                kind="water",
                due_date=now + timedelta(days=plant.frequency_days),
            )
        )

    session.commit()
    session.refresh(plant)

    dashboard_vm = build_dashboard(session).model_dump()
    village_vm = build_village(session, plant.village_id).model_dump()
    plant_vm = build_plant(session, plant_id).model_dump()
    today_vm = build_today(session).model_dump()
    return {
        "plant": plant_vm,
        "village": village_vm,
        "dashboard": dashboard_vm,
        "today": today_vm,
    }


# Logs ----------------------------------------------------------------------


@router.get("/logs", response_model=list[LogRead])
def list_logs(
    session: Session = Depends(get_session),
    plant_id: int | None = Query(default=None, description="Filter logs by plant"),
) -> list[LogRead]:
    query = session.query(Log)
    if plant_id is not None:
        query = query.filter(Log.plant_id == plant_id)
    logs = query.order_by(Log.ts.desc()).all()
    return [LogRead.model_validate(log) for log in logs]


@router.post("/logs", response_model=LogRead, status_code=status.HTTP_201_CREATED)
def create_log(payload: LogCreate, session: Session = Depends(get_session)) -> LogRead:
    _get_or_404(session, Plant, payload.plant_id, "Plant")
    log = Log(
        plant_id=payload.plant_id,
        kind=payload.kind,
        note=payload.note,
        ts=payload.ts,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return LogRead.model_validate(log)


@router.get("/logs/{log_id}", response_model=LogRead)
def get_log(log_id: int, session: Session = Depends(get_session)) -> LogRead:
    log = _get_or_404(session, Log, log_id, "Log")
    return LogRead.model_validate(log)


@router.delete(
    "/logs/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete_log(log_id: int, session: Session = Depends(get_session)) -> Response:
    log = _get_or_404(session, Log, log_id, "Log")
    session.delete(log)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/export")
def export_data(session: Session = Depends(get_session)) -> dict[str, object]:
    bundle = export_bundle(session)
    return bundle.model_dump(mode="json")


@router.post("/import")
def import_data(payload: ImportRequest, session: Session = Depends(get_session)) -> dict[str, object]:
    report = import_bundle(session, payload)
    return report.model_dump(mode="json")
