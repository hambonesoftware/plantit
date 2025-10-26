"""Plant-related API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session

from backend.database import get_session
from backend.models import Plant
from backend.repositories.plants import get_plant as fetch_plant
from backend.repositories.plants import list_plants as list_plants_records
from backend.schemas.log import LogCreate, LogRead
from backend.schemas.plant import (
    PlantCareProfileUpdate,
    PlantDetail,
    PlantRead,
    PlantTaskCreate,
    PlantUpdate,
)
from backend.schemas.task import TaskPlantSummary, TaskRead
from backend.services.plants import (
    add_log,
    get_detail,
    schedule_task,
    update_care_profile,
    update_plant,
)

router = APIRouter(prefix="/plants", tags=["plants"])


def _plant_or_404(session: Session, plant_id: int) -> Plant:
    plant = fetch_plant(session, plant_id)
    if plant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plant not found.")
    return plant


@router.get("", response_model=dict[str, list[PlantRead]])
def list_plants(
    *,
    session: Session = Depends(get_session),
    village_id: int | None = Query(default=None, alias="village_id"),
    query: str | None = Query(default=None, alias="q"),
    tag: str | None = Query(default=None),
) -> dict[str, list[PlantRead]]:
    plants = list_plants_records(
        session,
        village_id=village_id,
        query=query,
        tag=tag,
    )
    return {"items": [PlantRead.model_validate(plant.model_dump()) for plant in plants]}


@router.get("/{plant_id}", response_model=PlantDetail)
def get_plant_detail(plant_id: int, session: Session = Depends(get_session)) -> PlantDetail:
    detail = get_detail(session, plant_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plant not found.")
    return detail


@router.patch("/{plant_id}", response_model=PlantDetail)
def patch_plant(
    plant_id: int,
    payload: PlantUpdate,
    session: Session = Depends(get_session),
) -> PlantDetail:
    plant = _plant_or_404(session, plant_id)
    update_plant(session, plant, payload)
    session.refresh(plant)
    detail = get_detail(session, plant_id)
    assert detail is not None
    return detail


@router.put("/{plant_id}/care_profile", response_model=PlantDetail)
def put_care_profile(
    plant_id: int,
    payload: PlantCareProfileUpdate,
    session: Session = Depends(get_session),
) -> PlantDetail:
    plant = _plant_or_404(session, plant_id)
    update_care_profile(session, plant, payload)
    detail = get_detail(session, plant_id)
    assert detail is not None
    return detail


@router.get("/{plant_id}/logs", response_model=list[LogRead])
def get_logs(plant_id: int, session: Session = Depends(get_session)) -> list[LogRead]:
    plant = _plant_or_404(session, plant_id)
    detail = get_detail(session, plant.id)
    if detail is None:
        return []
    return detail.logs


@router.post("/{plant_id}/logs", response_model=LogRead, status_code=status.HTTP_201_CREATED)
def post_log(
    plant_id: int,
    payload: LogCreate,
    session: Session = Depends(get_session),
) -> LogRead:
    plant = _plant_or_404(session, plant_id)
    return add_log(session, plant, payload)


@router.post("/{plant_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    plant_id: int,
    payload: PlantTaskCreate,
    session: Session = Depends(get_session),
) -> TaskRead:
    plant = _plant_or_404(session, plant_id)
    task = schedule_task(session, plant, payload)
    session.refresh(task, attribute_names=["plant"])
    plant_summary = TaskPlantSummary(id=plant.id, name=plant.name)
    return TaskRead(
        id=task.id,
        plant_id=task.plant_id,
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        state=task.state,
        category=task.category,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
        plant=plant_summary,
    )
