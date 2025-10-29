"""Import/export utilities for Plantit data."""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from ..models import Log, Plant, Task, Village


class VillagePayload(BaseModel):
    id: int | None = None
    name: str
    note: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PlantPayload(BaseModel):
    id: int | None = None
    village_id: int
    name: str
    species: str | None = None
    frequency_days: int = Field(default=3, ge=1)
    photo_path: str | None = None
    last_watered_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TaskPayload(BaseModel):
    id: int | None = None
    plant_id: int
    kind: Literal["water", "fertilize", "repot"]
    due_date: datetime
    done_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class LogPayload(BaseModel):
    id: int | None = None
    plant_id: int
    ts: datetime
    kind: str
    note: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DataBundle(BaseModel):
    villages: list[VillagePayload] = Field(default_factory=list)
    plants: list[PlantPayload] = Field(default_factory=list)
    tasks: list[TaskPayload] = Field(default_factory=list)
    logs: list[LogPayload] = Field(default_factory=list)


class ImportRequest(DataBundle):
    dry_run: bool = True


class ImportReport(BaseModel):
    dry_run: bool
    applied: bool
    created: dict[str, int]
    updated: dict[str, int]
    errors: list[str]


def export_bundle(session: Session) -> DataBundle:
    """Return a serialisable snapshot of all domain tables."""
    villages = session.query(Village).order_by(Village.id.asc()).all()
    plants = session.query(Plant).order_by(Plant.id.asc()).all()
    tasks = session.query(Task).order_by(Task.id.asc()).all()
    logs = session.query(Log).order_by(Log.id.asc()).all()
    return DataBundle(
        villages=[VillagePayload.model_validate(v) for v in villages],
        plants=[PlantPayload.model_validate(p) for p in plants],
        tasks=[TaskPayload.model_validate(t) for t in tasks],
        logs=[LogPayload.model_validate(l) for l in logs],
    )


def import_bundle(session: Session, request: ImportRequest) -> ImportReport:
    """Apply an import bundle, optionally as a dry run."""
    counts_created: dict[str, int] = defaultdict(int)
    counts_updated: dict[str, int] = defaultdict(int)
    errors: list[str] = []

    village_id_map: dict[int, int] = {}
    plant_id_map: dict[int, int] = {}

    transaction = session.begin()
    try:
        for payload in request.villages:
            if payload.id is None:
                errors.append("Village missing id; supply ids to merge or create records.")
                continue
            existing = session.get(Village, payload.id)
            if existing:
                existing.name = payload.name
                existing.note = payload.note
                if payload.created_at:
                    existing.created_at = payload.created_at
                counts_updated["villages"] += 1
                village_id_map[payload.id] = existing.id
            else:
                village = Village(
                    id=payload.id,
                    name=payload.name,
                    note=payload.note,
                    created_at=payload.created_at or datetime.utcnow(),
                )
                session.add(village)
                session.flush()
                counts_created["villages"] += 1
                village_id_map[payload.id] = village.id

        for payload in request.plants:
            if payload.id is None:
                errors.append("Plant missing id; supply ids to merge or create records.")
                continue
            resolved_village_id = village_id_map.get(payload.village_id, payload.village_id)
            if session.get(Village, resolved_village_id) is None:
                errors.append(f"Plant {payload.name} references unknown village {payload.village_id}.")
                continue
            existing = session.get(Plant, payload.id)
            if existing:
                existing.village_id = resolved_village_id
                existing.name = payload.name
                existing.species = payload.species
                existing.frequency_days = payload.frequency_days
                existing.photo_path = payload.photo_path
                existing.last_watered_at = payload.last_watered_at
                counts_updated["plants"] += 1
                plant_id_map[payload.id] = existing.id
            else:
                plant = Plant(
                    id=payload.id,
                    village_id=resolved_village_id,
                    name=payload.name,
                    species=payload.species,
                    frequency_days=payload.frequency_days,
                    photo_path=payload.photo_path,
                    last_watered_at=payload.last_watered_at,
                )
                session.add(plant)
                session.flush()
                counts_created["plants"] += 1
                plant_id_map[payload.id] = plant.id

        for payload in request.tasks:
            if payload.id is None:
                errors.append("Task missing id; supply ids to merge or create records.")
                continue
            resolved_plant_id = plant_id_map.get(payload.plant_id, payload.plant_id)
            if session.get(Plant, resolved_plant_id) is None:
                errors.append(f"Task {payload.id} references unknown plant {payload.plant_id}.")
                continue
            existing = session.get(Task, payload.id)
            if existing:
                existing.plant_id = resolved_plant_id
                existing.kind = payload.kind
                existing.due_date = payload.due_date
                existing.done_at = payload.done_at
                counts_updated["tasks"] += 1
            else:
                task = Task(
                    id=payload.id,
                    plant_id=resolved_plant_id,
                    kind=payload.kind,
                    due_date=payload.due_date,
                    done_at=payload.done_at,
                )
                session.add(task)
                session.flush()
                counts_created["tasks"] += 1

        for payload in request.logs:
            if payload.id is None:
                errors.append("Log missing id; supply ids to merge or create records.")
                continue
            resolved_plant_id = plant_id_map.get(payload.plant_id, payload.plant_id)
            if session.get(Plant, resolved_plant_id) is None:
                errors.append(f"Log {payload.id} references unknown plant {payload.plant_id}.")
                continue
            existing = session.get(Log, payload.id)
            if existing:
                existing.plant_id = resolved_plant_id
                existing.ts = payload.ts
                existing.kind = payload.kind
                existing.note = payload.note
                counts_updated["logs"] += 1
            else:
                log = Log(
                    id=payload.id,
                    plant_id=resolved_plant_id,
                    ts=payload.ts,
                    kind=payload.kind,
                    note=payload.note,
                )
                session.add(log)
                session.flush()
                counts_created["logs"] += 1

        if errors or request.dry_run:
            transaction.rollback()
            applied = False
        else:
            transaction.commit()
            applied = True
    except Exception:
        transaction.rollback()
        raise

    return ImportReport(
        dry_run=request.dry_run,
        applied=applied,
        created={k: counts_created.get(k, 0) for k in ["villages", "plants", "tasks", "logs"]},
        updated={k: counts_updated.get(k, 0) for k in ["villages", "plants", "tasks", "logs"]},
        errors=errors,
    )
