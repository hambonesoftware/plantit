"""FastAPI application entry point for Plantit backend."""
from __future__ import annotations

import logging
from typing import Any, Dict, Sequence

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.services.fixtures import (
    DASHBOARD_PAYLOAD,
    EXPORT_BUNDLE,
    HEALTH_PAYLOAD,
    HELLO_PAYLOAD,
    PLANT_DETAIL_BY_ID,
    PLANT_TIMELINE_BY_ID,
    TODAY_TASKS_RESPONSE,
    VILLAGE_DETAIL_BY_ID,
    VILLAGE_PLANTS_BY_ID,
    VILLAGE_SUMMARIES,
)

LOGGER = logging.getLogger("plantit.backend")

app = FastAPI(title="Plantit Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5580"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup_event() -> None:
    LOGGER.info("backend-startup")


@app.get("/api/health", tags=["Health"])
async def get_health() -> Dict[str, Any]:
    """Return service readiness information."""
    return HEALTH_PAYLOAD


@app.get("/api/hello", tags=["Greetings"])
async def get_hello() -> Dict[str, str]:
    """Return a friendly greeting used for smoke tests."""
    return HELLO_PAYLOAD


@app.get("/api/dashboard", tags=["Dashboard"])
async def get_dashboard() -> Dict[str, Any]:
    """Return summary metrics and alerts for the dashboard cards."""
    return DASHBOARD_PAYLOAD


@app.get("/api/villages", tags=["Villages"])
async def list_villages(
    search_term: str = Query("", alias="searchTerm"),
    climate_zones: Sequence[str] = Query(default=(), alias="climateZones"),
    min_health: float | None = Query(default=None, alias="minHealth"),
) -> Dict[str, Any]:
    """Return the available village summaries and the applied filters."""

    applied_filters = {
        "searchTerm": search_term,
        "climateZones": list(climate_zones),
        "minHealth": min_health,
    }

    return {"villages": VILLAGE_SUMMARIES, "appliedFilters": applied_filters}


@app.get("/api/villages/{village_id}", tags=["Villages"])
async def get_village(village_id: str) -> Dict[str, Any]:
    """Return additional information for a specific village."""

    village = VILLAGE_DETAIL_BY_ID.get(village_id)
    if village is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    return {"village": village}


@app.get("/api/villages/{village_id}/plants", tags=["Plants"])
async def list_village_plants(village_id: str) -> Dict[str, Any]:
    """Return plants that belong to the requested village."""

    plants = VILLAGE_PLANTS_BY_ID.get(village_id)
    if plants is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    village_summary = next((item for item in VILLAGE_SUMMARIES if item["id"] == village_id), None)
    if village_summary is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Village not found")

    return {"village": village_summary, "plants": plants}


@app.get("/api/plants/{plant_id}", tags=["Plants"])
async def get_plant(plant_id: str) -> Dict[str, Any]:
    """Return the plant detail payload and recent timeline events."""

    plant = PLANT_DETAIL_BY_ID.get(plant_id)
    if plant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plant not found")

    timeline = PLANT_TIMELINE_BY_ID.get(plant_id, [])
    return {"plant": plant, "timeline": timeline}


@app.get("/api/today", tags=["Today"])
async def get_today_tasks() -> Dict[str, Any]:
    """Return the list of scheduled tasks for the current day."""

    return TODAY_TASKS_RESPONSE


@app.post("/api/import", tags=["Import/Export"], status_code=status.HTTP_202_ACCEPTED)
async def post_import_bundle(bundle: Dict[str, Any]) -> Dict[str, Any]:
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
async def get_export_bundle() -> Dict[str, Any]:
    """Return a stub export bundle."""

    return EXPORT_BUNDLE
