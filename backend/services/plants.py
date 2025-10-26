"""Domain services for plant detail and care profile management."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date

from sqlmodel import Session

from backend.models import Photo, Plant, Task
from backend.models.task import TaskCategory, TaskState
from backend.repositories.logs import create_log as create_log_entry
from backend.repositories.logs import list_logs
from backend.repositories.plants import update_plant as update_plant_record
from backend.repositories.tasks import (
    create_task as create_task_record,
    list_tasks,
)
from backend.schemas.log import LogCreate, LogRead
from backend.schemas.photo import PhotoRead
from backend.schemas.plant import (
    PlantCareProfile,
    PlantCareProfileUpdate,
    PlantDetail,
    PlantOverviewMetrics,
    PlantTaskCreate,
    PlantUpdate,
)
from backend.schemas.task import TaskCreate, TaskRead
from backend.services import cadence
from backend.services.tasks import serialize_task
from backend.services.timeutils import utcnow


def _serialize_photo(photo: Photo) -> PhotoRead:
    return PhotoRead.model_validate(photo.model_dump())


def _serialize_log(log) -> LogRead:
    return LogRead.model_validate(log.model_dump())


def _load_care_profile(plant: Plant) -> PlantCareProfile:
    return PlantCareProfile.model_validate(plant.care_profile or {})


def _store_care_profile(plant: Plant, profile: PlantCareProfile) -> None:
    payload = profile.model_dump()
    payload["updated_at"] = utcnow().isoformat()
    plant.care_profile = payload
    plant.updated_at = utcnow()


def update_plant(session: Session, plant: Plant, payload: PlantUpdate) -> Plant:
    updated = update_plant_record(session, plant, payload)
    return updated


def schedule_task(session: Session, plant: Plant, payload: PlantTaskCreate) -> Task:
    raw_category = payload.category
    category = TaskCategory.custom
    if raw_category is not None:
        try:
            category = TaskCategory(raw_category)
        except ValueError:
            category = TaskCategory.custom
    task_payload = TaskCreate(
        plant_id=plant.id,
        title=payload.title or cadence.default_title(category, payload.title),
        description=payload.description,
        due_date=payload.due_date,
        category=category,
    )
    task = create_task_record(session, task_payload)
    return task


def add_log(session: Session, plant: Plant, payload: LogCreate) -> LogRead:
    log = create_log_entry(session, plant.id, payload)
    session.refresh(plant, attribute_names=["logs"])
    return _serialize_log(log)

def update_care_profile(
    session: Session,
    plant: Plant,
    payload: PlantCareProfileUpdate,
) -> PlantCareProfile:
    profile = _load_care_profile(plant)
    data = profile.model_dump()
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(profile, key, value)
        data[key] = value
    new_profile = PlantCareProfile.model_validate(data)
    _store_care_profile(plant, new_profile)
    session.add(plant)
    session.commit()
    session.refresh(plant)
    serialized_logs = [_serialize_log(log) for log in list_logs(session, plant_id=plant.id, limit=100)]
    cadence.sync_tasks_for_profile(
        session,
        plant=plant,
        profile=new_profile,
        logs=serialized_logs,
        reference_date=date.today(),
    )
    session.refresh(plant, attribute_names=["tasks"])
    return PlantCareProfile.model_validate(plant.care_profile)


def _hero_photo(photos: Sequence[Photo]) -> Photo | None:
    if not photos:
        return None
    return max(photos, key=lambda photo: (photo.captured_at, photo.uploaded_at))


def get_detail(session: Session, plant_id: int) -> PlantDetail | None:
    plant = session.get(Plant, plant_id)
    if plant is None:
        return None
    session.refresh(plant, attribute_names=["photos", "tasks", "logs"])
    profile = _load_care_profile(plant)
    photos = sorted(plant.photos, key=lambda photo: (photo.captured_at, photo.id), reverse=True)
    hero = _hero_photo(plant.photos)
    logs_serialized = [_serialize_log(log) for log in list_logs(session, plant_id=plant.id, limit=50)]
    tasks_serialized = [
        serialize_task(task)
        for task in list_tasks(
            session,
            plant_id=plant.id,
            include_completed=False,
            with_plant=True,
        )
    ]
    today = date.today()
    due = 0
    overdue = 0
    for task in plant.tasks:
        if task.state != TaskState.pending or task.due_date is None:
            continue
        if task.due_date < today:
            overdue += 1
        if task.due_date <= today:
            due += 1
    last_logged = logs_serialized[0].performed_at if logs_serialized else None
    metrics = PlantOverviewMetrics(
        due_tasks=due,
        overdue_tasks=overdue,
        last_logged_at=last_logged,
    )
    return PlantDetail(
        id=plant.id,
        village_id=plant.village_id,
        name=plant.name,
        species=plant.species,
        variety=plant.variety,
        kind=plant.kind,
        acquired_on=plant.acquired_on,
        tags=list(plant.tags),
        notes=plant.notes,
        created_at=plant.created_at,
        updated_at=plant.updated_at,
        care_profile=profile,
        hero_photo=(PhotoRead.model_validate(hero.model_dump()) if hero else None),
        photos=[_serialize_photo(photo) for photo in photos],
        tasks=tasks_serialized,
        logs=logs_serialized,
        metrics=metrics,
    )
