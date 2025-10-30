"""FastAPI application entry point for Plantit backend."""
from __future__ import annotations

import logging
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
