"""Dashboard aggregates endpoint."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from backend.database import get_session
from backend.schemas.dashboard import DashboardResponse
from backend.services.dashboard import build_dashboard

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    *,
    session: Session = Depends(get_session),
    today: date | None = Query(default=None),
) -> DashboardResponse:
    """Return aggregated dashboard data."""

    payload = build_dashboard(session, today=today)
    return DashboardResponse(**payload)
