"""FastAPI application entry point for Plantit backend."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Sequence

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

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

    villages = [
        {
            "id": village.id,
            "name": village.name,
            "climate": village.climate,
            "plantCount": len(village.plants),
            "healthScore": village.health_score,
        }
        for village in query.all()
    ]

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

    return {
        "village": {
            "id": village.id,
            "name": village.name,
            "climate": village.climate,
            "plantCount": len(village.plants),
            "healthScore": village.health_score,
            "description": village.description,
            "establishedAt": village.established_at.isoformat() if village.established_at else None,
            "irrigationType": village.irrigation_type,
        }
    }


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

    village_summary = {
        "id": village.id,
        "name": village.name,
        "climate": village.climate,
        "plantCount": len(village.plants),
        "healthScore": village.health_score,
    }

    plants = [
        {
            "id": plant.id,
            "displayName": plant.display_name,
            "species": plant.species,
            "stage": plant.stage,
            "lastWateredAt": plant.last_watered_at.isoformat() if plant.last_watered_at else None,
            "healthScore": plant.health_score,
        }
        for plant in village.plants
    ]

    return {"village": village_summary, "plants": plants}


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

    plant_payload = {
        "id": plant.id,
        "displayName": plant.display_name,
        "species": plant.species,
        "villageName": plant.village.name,
        "lastWateredAt": plant.last_watered_at.isoformat() if plant.last_watered_at else None,
        "healthScore": plant.health_score,
        "notes": plant.notes,
    }
    timeline = seed_content.PLANT_TIMELINE.get(plant.id, [])
    return {"plant": plant_payload, "timeline": timeline}


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
            "id": village.id,
            "name": village.name,
            "climate": village.climate,
            "plantCount": len(village.plants),
            "healthScore": village.health_score,
            "establishedAt": village.established_at.isoformat() if village.established_at else None,
        }
        for village in villages
    ]
    payload_plants = [
        {
            "id": plant.id,
            "displayName": plant.display_name,
            "species": plant.species,
            "villageId": plant.village_id,
            "lastWateredAt": plant.last_watered_at.isoformat() if plant.last_watered_at else None,
            "healthScore": plant.health_score,
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
