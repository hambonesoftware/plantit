"""Export and import helpers for Plantit."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Any, Sequence

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel, select

from backend.config import Settings, get_settings
from backend.models import Log, Photo, Plant, Task, Village
from backend.models.plant import PlantKind
from backend.models.task import TaskCategory, TaskState
from backend.schemas.backup import (
    ExportBundle,
    ExportMeta,
    ExportScope,
    ImportSummary,
    LogRecord,
    MediaManifestEntry,
    PhotoRecord,
    PlantRecord,
    TaskRecord,
    VillageRecord,
)
from backend.services.timeutils import utcnow


def export_bundle(
    session: Session,
    *,
    scope: ExportScope = ExportScope.all,
    target_id: int | None = None,
    settings: Settings | None = None,
) -> ExportBundle:
    """Create an export bundle for the requested scope."""

    cfg = settings or get_settings()
    filter_info: dict[str, int | None] = {}

    villages: list[Village] = []
    plants: list[Plant] = []

    if scope is ExportScope.all:
        villages = session.exec(select(Village).order_by(Village.id)).all()
        plants = session.exec(select(Plant).order_by(Plant.id)).all()
    elif scope is ExportScope.village:
        if target_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="village_id is required for scope 'village'.",
            )
        village = session.get(Village, target_id)
        if village is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Village not found.")
        villages = [village]
        plants = (
            session.exec(
                select(Plant).where(Plant.village_id == village.id).order_by(Plant.id)
            ).all()
        )
        filter_info["village_id"] = village.id
    elif scope is ExportScope.plant:
        if target_id is None:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail="plant_id is required for scope 'plant'.",
            )
        plant = session.get(Plant, target_id)
        if plant is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plant not found.")
        plants = [plant]
        filter_info["plant_id"] = plant.id
        village = session.get(Village, plant.village_id)
        if village is not None:
            villages = [village]
            filter_info.setdefault("village_id", village.id)
    else:  # pragma: no cover - defensive branch for enum
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Unsupported export scope.")

    plant_ids = [plant.id for plant in plants]
    if plant_ids:
        tasks = session.exec(select(Task).where(Task.plant_id.in_(plant_ids))).all()
        logs = session.exec(select(Log).where(Log.plant_id.in_(plant_ids))).all()
        photos = session.exec(select(Photo).where(Photo.plant_id.in_(plant_ids))).all()
    else:
        tasks = []
        logs = []
        photos = []

    media_entries = [
        MediaManifestEntry(
            file_path=photo.file_path,
            thumbnail_path=photo.thumbnail_path,
            size_bytes=photo.size_bytes,
            exists=_media_exists(cfg.media_root, photo.file_path, photo.thumbnail_path),
        )
        for photo in photos
    ]

    return ExportBundle(
        meta=ExportMeta(exported_at=utcnow(), scope=scope, filter=filter_info),
        villages=[_serialize_village(village) for village in villages],
        plants=[_serialize_plant(plant) for plant in plants],
        tasks=[_serialize_task(task) for task in tasks],
        logs=[_serialize_log(log) for log in logs],
        photos=[_serialize_photo(photo) for photo in photos],
        media=media_entries,
    )


def import_bundle(
    session: Session,
    bundle: ExportBundle,
    *,
    settings: Settings | None = None,
) -> ImportSummary:
    """Import an export bundle and upsert contained records."""

    cfg = settings or get_settings()

    created_counts = defaultdict(int)
    updated_counts = defaultdict(int)
    conflicts: list[str] = []
    id_map: dict[str, dict[int, int]] = {
        "villages": {},
        "plants": {},
        "tasks": {},
        "logs": {},
        "photos": {},
    }

    for record in bundle.villages:
        payload = record.model_dump()
        new_id, created, conflict = _upsert_model(
            session,
            Village,
            payload,
            natural_keys=("name",),
        )
        id_map["villages"][record.id] = new_id
        if created:
            created_counts["villages"] += 1
        else:
            updated_counts["villages"] += 1
        if conflict:
            conflicts.append(f"Village {record.id} remapped to {new_id}")

    for record in bundle.plants:
        payload = record.model_dump()
        payload["village_id"] = id_map["villages"].get(payload["village_id"], payload["village_id"])
        payload["kind"] = PlantKind(payload["kind"])
        payload["tags"] = list(payload.get("tags") or [])
        payload["care_profile"] = dict(payload.get("care_profile") or {})
        new_id, created, conflict = _upsert_model(
            session,
            Plant,
            payload,
            natural_keys=("name", "village_id"),
        )
        id_map["plants"][record.id] = new_id
        if created:
            created_counts["plants"] += 1
        else:
            updated_counts["plants"] += 1
        if conflict:
            conflicts.append(f"Plant {record.id} remapped to {new_id}")

    for record in bundle.tasks:
        payload = record.model_dump()
        payload["plant_id"] = id_map["plants"].get(payload["plant_id"], payload["plant_id"])
        payload["state"] = TaskState(payload["state"])
        payload["category"] = TaskCategory(payload["category"])
        new_id, created, conflict = _upsert_model(
            session,
            Task,
            payload,
            natural_keys=("plant_id", "title", "due_date"),
        )
        id_map["tasks"][record.id] = new_id
        if created:
            created_counts["tasks"] += 1
        else:
            updated_counts["tasks"] += 1
        if conflict:
            conflicts.append(f"Task {record.id} remapped to {new_id}")

    for record in bundle.logs:
        payload = record.model_dump()
        payload["plant_id"] = id_map["plants"].get(payload["plant_id"], payload["plant_id"])
        task_id = payload.get("task_id")
        if task_id is not None:
            payload["task_id"] = id_map["tasks"].get(task_id)
        new_id, created, conflict = _upsert_model(
            session,
            Log,
            payload,
            natural_keys=("plant_id", "action", "performed_at"),
        )
        id_map["logs"][record.id] = new_id
        if created:
            created_counts["logs"] += 1
        else:
            updated_counts["logs"] += 1
        if conflict:
            conflicts.append(f"Log {record.id} remapped to {new_id}")

    for record in bundle.photos:
        payload = record.model_dump()
        payload["plant_id"] = id_map["plants"].get(payload["plant_id"], payload["plant_id"])
        new_id, created, conflict = _upsert_model(
            session,
            Photo,
            payload,
            natural_keys=("plant_id", "file_path"),
        )
        id_map["photos"][record.id] = new_id
        if created:
            created_counts["photos"] += 1
        else:
            updated_counts["photos"] += 1
        if conflict:
            conflicts.append(f"Photo {record.id} remapped to {new_id}")

    for entry in bundle.media:
        target_file = cfg.media_root / entry.file_path
        target_thumb = cfg.media_root / entry.thumbnail_path
        target_file.parent.mkdir(parents=True, exist_ok=True)
        target_thumb.parent.mkdir(parents=True, exist_ok=True)
        if not _media_exists(cfg.media_root, entry.file_path, entry.thumbnail_path):
            conflicts.append(f"Missing media file: {entry.file_path}")

    status_value: str = "success" if not conflicts else "partial"

    return ImportSummary(
        status=status_value,  # type: ignore[arg-type]
        created=dict(created_counts),
        updated=dict(updated_counts),
        conflicts=conflicts,
        id_map=id_map,
    )


def _media_exists(base: Path, file_path: str, thumbnail_path: str) -> bool:
    original = (base / file_path).resolve()
    thumbnail = (base / thumbnail_path).resolve()
    try:
        base_resolved = base.resolve()
    except FileNotFoundError:  # pragma: no cover - defensive
        return False
    return original.exists() and thumbnail.exists() and base_resolved in original.parents and base_resolved in thumbnail.parents


def _serialize_village(village: Village) -> VillageRecord:
    payload = village.model_dump(exclude={"plants"})
    return VillageRecord.model_validate(payload)


def _serialize_plant(plant: Plant) -> PlantRecord:
    payload = plant.model_dump(exclude={"village", "tasks", "logs", "photos"})
    payload["kind"] = plant.kind.value
    payload["tags"] = list(plant.tags or [])
    payload["care_profile"] = dict(plant.care_profile or {})
    return PlantRecord.model_validate(payload)


def _serialize_task(task: Task) -> TaskRecord:
    payload = task.model_dump(exclude={"plant", "logs"})
    payload["state"] = task.state.value
    payload["category"] = task.category.value
    return TaskRecord.model_validate(payload)


def _serialize_log(log: Log) -> LogRecord:
    payload = log.model_dump(exclude={"plant", "task"})
    return LogRecord.model_validate(payload)


def _serialize_photo(photo: Photo) -> PhotoRecord:
    payload = photo.model_dump(exclude={"plant"})
    return PhotoRecord.model_validate(payload)


def _upsert_model(
    session: Session,
    model: type[SQLModel],
    payload: dict[str, Any],
    *,
    natural_keys: Sequence[str] | None = None,
) -> tuple[int, bool, bool]:
    """Insert or update a SQLModel row from serialized payload.

    Returns a tuple of ``(new_id, created, conflict)`` where ``conflict`` indicates
    the record had to be remapped due to identifier collisions.
    """

    identifier = payload.get("id")
    created = False
    conflict = False

    if identifier is not None:
        existing = session.get(model, identifier)
        if existing is not None:
            for key, value in payload.items():
                if key == "id":
                    continue
                setattr(existing, key, value)
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return existing.id, created, conflict

    instance = model(**payload)
    session.add(instance)
    try:
        session.commit()
        session.refresh(instance)
        created = True
        return instance.id, created, conflict
    except IntegrityError:
        session.rollback()
        conflict = True
        target = None
        if natural_keys:
            statement = select(model)
            for key in natural_keys:
                statement = statement.where(getattr(model, key) == payload.get(key))
            target = session.exec(statement).first()
        if target is not None:
            for key, value in payload.items():
                if key == "id":
                    continue
                setattr(target, key, value)
            session.add(target)
            session.commit()
            session.refresh(target)
            return target.id, created, conflict
        sanitized = {key: value for key, value in payload.items() if key != "id"}
        instance = model(**sanitized)
        session.add(instance)
        session.commit()
        session.refresh(instance)
        created = True
        return instance.id, created, conflict
