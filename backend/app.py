"""FastAPI application entry point for Plantit backend."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    return {"status": "ok", "checks": {"db": "ok"}}


@app.get("/api/hello", tags=["Greetings"])
async def get_hello() -> Dict[str, str]:
    """Return a friendly greeting used for smoke tests."""
    return {"message": "Hello, Plantit"}


@app.post("/api/import", tags=["Import/Export"])
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

    generated_at = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

    return {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "metadata": {
            "source": "stub",
            "note": "Replace with real data when persistence is wired up.",
        },
        "payload": {
            "villages": [],
            "plants": [],
        },
    }
