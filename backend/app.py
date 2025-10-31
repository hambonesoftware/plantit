"""FastAPI application entry point for Plantit backend."""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, Sequence
from uuid import uuid4

from fastapi import Body, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from pydantic import BaseModel, Field, validator

from backend.data import seed_content
from backend.db import models
from backend.db.migrate import ensure_migrations, get_migration_state
from backend.db.seed import seed_demo_data
from backend.db.session import engine, get_session, session_scope

LOGGER = logging.getLogger("plantit.backend")

app = FastAPI(title="Plantit Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5580"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_BOOTSTRAPPED = False


def _bootstrap_once() -> None:
    global _BOOTSTRAPPED
    if _BOOTSTRAPPED:
        return
    applied = ensure_migrations(engine)
    if applied:
        LOGGER.info("migrations-applied", extra={"versions": applied})
    with session_scope() as session:
        seed_demo_data(session)
    _BOOTSTRAPPED = True


_bootstrap_once()


@app.on_event("startup")
def _startup_event() -> None:
    LOGGER.info("backend-startup")
    _bootstrap_once()


def _serialize_timestamp(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _touch_village(village: models.Village | None) -> None:
    if village is not None:
        village.updated_at = _now_utc()


def _touch_plant(plant: models.Plant | None) -> None:
    if plant is not None:
        plant.updated_at = _now_utc()


def _serialize_village_summary(village: models.Village) -> Dict[str, Any]:
    return {
        "id": village.id,
        "name": village.name,
        "climate": village.climate,
        "plantCount": len(village.plants),
        "healthScore": village.health_score,
        "updatedAt": _serialize_timestamp(village.updated_at),
    }


def _serialize_village_detail(village: models.Village) -> Dict[str, Any]:
    summary = _serialize_village_summary(village)
    return {
        **summary,
        "description": village.description,
        "establishedAt": village.established_at.isoformat()
        if village.established_at
        else None,
        "irrigationType": village.irrigation_type,
    }


def _serialize_plant_summary(plant: models.Plant) -> Dict[str, Any]:
    return {
        "id": plant.id,
        "displayName": plant.display_name,
        "species": plant.species,
        "stage": plant.stage,
        "lastWateredAt": _serialize_timestamp(plant.last_watered_at),
        "healthScore": plant.health_score,
        "updatedAt": _serialize_timestamp(plant.updated_at),
        "notes": plant.notes,
    }


def _serialize_plant_detail(plant: models.Plant) -> Dict[str, Any]:
    summary = _serialize_plant_summary(plant)
    return {
        **summary,
        "notes": plant.notes,
        "villageId": plant.village_id,
        "villageName": plant.village.name if plant.village else None,
    }


def _assert_village_version(village: models.Village, expected: datetime) -> None:
    if _serialize_timestamp(village.updated_at) != _serialize_timestamp(expected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Village has been modified. Refresh and retry.",
        )


def _assert_plant_version(plant: models.Plant, expected: datetime) -> None:
    if _serialize_timestamp(plant.updated_at) != _serialize_timestamp(expected):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plant has been modified. Refresh and retry.",
        )


class VillageBaseModel(BaseModel):
    name: str = Field(..., min_length=1)
    climate: str = Field(..., min_length=1)
    description: str | None = Field(default=None)
    established_at: date | None = Field(default=None, alias="establishedAt")
    irrigation_type: str | None = Field(default=None, alias="irrigationType")
    health_score: float = Field(..., ge=0.0, le=1.0, alias="healthScore")

    class Config:
        allow_population_by_field_name = True

    @validator("name", "climate")
    def _validate_required(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be empty")
        return normalized

    @validator("description", "irrigation_type", pre=True)
    def _normalize_optional(cls, value: Any) -> Any:  # noqa: N805 - pydantic signature
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class VillageCreateRequest(VillageBaseModel):
    pass


class VillageUpdateRequest(VillageBaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


class VillageDeleteRequest(BaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


_VALID_STAGES = {"seedling", "vegetative", "flowering", "mature"}


class PlantBaseModel(BaseModel):
    display_name: str = Field(..., alias="displayName", min_length=1)
    species: str = Field(..., min_length=1)
    stage: str = Field(..., min_length=1)
    last_watered_at: datetime | None = Field(default=None, alias="lastWateredAt")
    health_score: float = Field(..., ge=0.0, le=1.0, alias="healthScore")
    notes: str | None = Field(default=None)

    class Config:
        allow_population_by_field_name = True

    @validator("display_name", "species")
    def _require_text(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be empty")
        return normalized

    @validator("stage")
    def _validate_stage(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip().lower()
        if normalized not in _VALID_STAGES:
            raise ValueError(f"stage must be one of {sorted(_VALID_STAGES)}")
        return normalized

    @validator("notes", pre=True)
    def _normalize_notes(cls, value: Any) -> Any:  # noqa: N805 - pydantic signature
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class PlantCreateRequest(PlantBaseModel):
    village_id: str = Field(..., alias="villageId", min_length=1)

    @validator("village_id")
    def _normalize_village(cls, value: str) -> str:  # noqa: N805 - pydantic signature
        normalized = value.strip()
        if not normalized:
            raise ValueError("villageId must not be empty")
        return normalized


class PlantUpdateRequest(PlantBaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")


class PlantDeleteRequest(BaseModel):
    updated_at: datetime = Field(..., alias="updatedAt")
@app.get("/api/health", tags=["Health"])
def get_health() -> Dict[str, Any]:
    """Return service readiness information."""

    try:
        with engine.connect() as connection:
            connection.execute(select(1))
        db_status = "ok"
    except Exception as exc:  # pragma: no cover - defensive logging path
        LOGGER.exception("db-health-check-failed")
        db_status = f"error: {exc.__class__.__name__}"

    migration_state = get_migration_state(engine)
    migration_status = "ok" if not migration_state["pending"] else "pending: " + ", ".join(
        migration_state["pending"]
    )
    overall_status = "ok" if db_status == "ok" and not migration_state["pending"] else "degraded"
    return {"status": overall_status, "checks": {"db": db_status, "migrations": migration_status}}


@app.get("/api/hello", tags=["Greetings"])
def get_hello() -> Dict[str, str]:
    """Return a friendly greeting used for smoke tests."""

    return {"message": "Hello, Plantit"}


@app.get("/api/dashboard", tags=["Dashboard"])
def get_dashboard(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return summary metrics and alerts for the dashboard cards."""

    total_plants = session.execute(select(func.count(models.Plant.id))).scalar_one()
    active_villages = session.execute(select(func.count(models.Village.id))).scalar_one()
    success_rate = session.execute(select(func.avg(models.Plant.health_score))).scalar_one()
    upcoming_tasks = session.execute(select(func.count(models.Task.id))).scalar_one()

    summary = {
        "totalPlants": total_plants,
        "activeVillages": active_villages,
        "successRate": round(success_rate or 0.0, 2),
        "upcomingTasks": upcoming_tasks,
    }
    return {
        "summary": summary,
        "alerts": seed_content.DASHBOARD_ALERTS,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/villages", tags=["Villages"])
def list_villages(
    search_term: str = Query("", alias="searchTerm"),
    climate_zones: Sequence[str] = Query(default=(), alias="climateZones"),
    min_health: float | None = Query(default=None, alias="minHealth"),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Return the available village summaries and the applied filters."""

    query = (
        session.query(models.Village)
        .options(selectinload(models.Village.plants))
        .order_by(models.Village.name)
    )

    if search_term:
        term = f"%{search_term.lower()}%"
        query = query.filter(func.lower(models.Village.name).like(term))
    if climate_zones:
        query = query.filter(models.Village.climate.in_(climate_zones))
    if min_health is not None:
        query = query.filter(models.Village.health_score >= min_health)

    villages = [_serialize_village_summary(village) for village in query.all()]

    applied_filters = {
        "searchTerm": search_term,
        "climateZones": list(climate_zones),
        "minHealth": min_health,
    }

    return {"villages": villages, "appliedFilters": applied_filters}


@app.get("/api/villages/{village_id}", tags=["Villages"])
def get_village(village_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return additional information for a specific village."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    return {"village": _serialize_village_detail(village)}


@app.get("/api/villages/{village_id}/plants", tags=["Plants"])
def list_village_plants(village_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return plants that belong to the requested village."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    village_summary = _serialize_village_summary(village)

    plants = [_serialize_plant_summary(plant) for plant in village.plants]

    return {"village": village_summary, "plants": plants}


@app.post("/api/villages", tags=["Villages"], status_code=status.HTTP_201_CREATED)
def create_village(
    payload: VillageCreateRequest, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Create a new village record."""

    village = models.Village(
        id=str(uuid4()),
        name=payload.name,
        climate=payload.climate,
        description=payload.description,
        established_at=payload.established_at,
        irrigation_type=payload.irrigation_type,
        health_score=payload.health_score,
    )
    session.add(village)
    session.commit()
    session.refresh(village)

    return {"village": _serialize_village_detail(village)}


@app.put("/api/villages/{village_id}", tags=["Villages"])
def update_village(
    village_id: str,
    payload: VillageUpdateRequest,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Update an existing village with optimistic concurrency checking."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    _assert_village_version(village, payload.updated_at)

    village.name = payload.name
    village.climate = payload.climate
    village.description = payload.description
    village.established_at = payload.established_at
    village.irrigation_type = payload.irrigation_type
    village.health_score = payload.health_score
    _touch_village(village)
    session.commit()
    session.refresh(village)

    return {"village": _serialize_village_detail(village)}


@app.delete("/api/villages/{village_id}", tags=["Villages"])
def delete_village(
    village_id: str,
    payload: VillageDeleteRequest = Body(...),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Delete a village when the client holds the latest version token."""

    village = session.get(
        models.Village,
        village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    _assert_village_version(village, payload.updated_at)

    session.delete(village)
    session.commit()

    return {
        "status": "deleted",
        "villageId": village_id,
        "updatedAt": _serialize_timestamp(payload.updated_at),
    }


@app.get("/api/plants/{plant_id}", tags=["Plants"])
def get_plant(plant_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return the plant detail payload and recent timeline events."""

    plant = session.get(
        models.Plant,
        plant_id,
        options=(selectinload(models.Plant.village),),
    )
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    plant_payload = _serialize_plant_detail(plant)
    timeline = seed_content.PLANT_TIMELINE.get(plant.id, [])
    return {"plant": plant_payload, "timeline": timeline}


@app.post("/api/plants", tags=["Plants"], status_code=status.HTTP_201_CREATED)
def create_plant(
    payload: PlantCreateRequest, session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Create a plant within the specified village."""

    village = session.get(
        models.Village,
        payload.village_id,
        options=(selectinload(models.Village.plants),),
    )
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    plant = models.Plant(
        id=str(uuid4()),
        village=village,
        display_name=payload.display_name,
        species=payload.species,
        stage=payload.stage,
        last_watered_at=payload.last_watered_at,
        health_score=payload.health_score,
        notes=payload.notes,
    )
    session.add(plant)
    _touch_village(village)
    session.commit()
    session.refresh(plant)
    updated_village = session.get(
        models.Village,
        plant.village_id,
        options=(selectinload(models.Village.plants),),
    )

    response: Dict[str, Any] = {"plant": _serialize_plant_detail(plant)}
    if updated_village is not None:
        response["village"] = _serialize_village_summary(updated_village)
    return response


@app.put("/api/plants/{plant_id}", tags=["Plants"])
def update_plant(
    plant_id: str,
    payload: PlantUpdateRequest,
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Update an existing plant with optimistic concurrency."""

    plant = session.get(
        models.Plant,
        plant_id,
        options=(selectinload(models.Plant.village),),
    )
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    _assert_plant_version(plant, payload.updated_at)

    plant.display_name = payload.display_name
    plant.species = payload.species
    plant.stage = payload.stage
    plant.last_watered_at = payload.last_watered_at
    plant.health_score = payload.health_score
    plant.notes = payload.notes
    _touch_plant(plant)
    _touch_village(plant.village)
    session.commit()
    session.refresh(plant)

    updated_village = None
    if plant.village_id is not None:
        updated_village = session.get(
            models.Village,
            plant.village_id,
            options=(selectinload(models.Village.plants),),
        )

    response: Dict[str, Any] = {"plant": _serialize_plant_detail(plant)}
    if updated_village is not None:
        response["village"] = _serialize_village_summary(updated_village)
    return response


@app.delete("/api/plants/{plant_id}", tags=["Plants"])
def delete_plant(
    plant_id: str,
    payload: PlantDeleteRequest = Body(...),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """Remove a plant, returning the updated village summary."""

    plant = session.get(
        models.Plant,
        plant_id,
        options=(selectinload(models.Plant.village),),
    )
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    _assert_plant_version(plant, payload.updated_at)

    owning_village = plant.village
    _touch_village(owning_village)
    village_id = plant.village_id
    session.delete(plant)
    session.commit()

    updated_village = None
    if village_id is not None:
        updated_village = session.get(
            models.Village,
            village_id,
            options=(selectinload(models.Village.plants),),
        )

    response: Dict[str, Any] = {
        "status": "deleted",
        "plantId": plant_id,
        "updatedAt": _serialize_timestamp(payload.updated_at),
    }
    if updated_village is not None:
        response["village"] = _serialize_village_summary(updated_village)
    return response


@app.get("/api/today", tags=["Today"])
def get_today_tasks(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return the list of scheduled tasks for the current day."""

    tasks = session.query(models.Task).order_by(models.Task.due_at).all()
    return {
        "tasks": [
            {
                "id": task.id,
                "type": task.task_type,
                "plantId": task.plant_id,
                "plantName": task.plant_name,
                "villageName": task.village_name,
                "dueAt": task.due_at.isoformat(),
                "priority": task.priority,
            }
            for task in tasks
        ],
        "emptyStateMessage": None,
    }


@app.post("/api/import", tags=["Import/Export"], status_code=status.HTTP_202_ACCEPTED)
def post_import_bundle(bundle: Dict[str, Any]) -> Dict[str, Any]:
    """Accept an import preview payload for future processing."""

    schema_version = bundle.get("schemaVersion")
    summary = bundle.get("summary", {})

    LOGGER.info(
        "import-preview",
        extra={"schema_version": schema_version, "summary": summary},
    )

    return {
        "status": "accepted",
        "schemaVersion": schema_version,
        "summary": summary,
        "message": "Import preview accepted. Server-side import not yet implemented.",
    }


@app.get("/api/export", tags=["Import/Export"])
def get_export_bundle(session: Session = Depends(get_session)) -> Dict[str, Any]:
    """Return a stub export bundle."""

    villages = (
        session.query(models.Village)
        .options(selectinload(models.Village.plants))
        .order_by(models.Village.name)
        .all()
    )
    payload_villages = [
        {
            **_serialize_village_summary(village),
            "establishedAt": village.established_at.isoformat()
            if village.established_at
            else None,
        }
        for village in villages
    ]
    payload_plants = [
        {
            **_serialize_plant_summary(plant),
            "villageId": plant.village_id,
        }
        for village in villages
        for plant in village.plants
    ]

    return {
        "schemaVersion": seed_content.EXPORT_METADATA["schemaVersion"],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metadata": seed_content.EXPORT_METADATA["metadata"],
        "payload": {"villages": payload_villages, "plants": payload_plants},
    }
