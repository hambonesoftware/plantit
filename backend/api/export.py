"""Export and import API endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from backend.config import get_settings
from backend.database import get_session
from backend.schemas.backup import ExportBundle, ExportScope, ImportSummary
from backend.services import backup

router = APIRouter(tags=["backup"])


@router.get("/export", response_model=ExportBundle)
def export_data(
    scope: ExportScope = Query(default=ExportScope.all, description="Scope of the export"),
    target_id: int | None = Query(
        default=None,
        ge=1,
        description="Identifier for plant or village when scope requires it.",
    ),
    session: Session = Depends(get_session),
) -> ExportBundle:
    """Return an export bundle for the requested scope."""

    resolved_target = target_id if scope is not ExportScope.all else None
    settings = get_settings()
    return backup.export_bundle(session, scope=scope, target_id=resolved_target, settings=settings)


@router.post("/import", response_model=ImportSummary)
def import_data(
    bundle: ExportBundle,
    session: Session = Depends(get_session),
) -> ImportSummary:
    """Import a bundle and upsert records."""

    settings = get_settings()
    return backup.import_bundle(session, bundle, settings=settings)
