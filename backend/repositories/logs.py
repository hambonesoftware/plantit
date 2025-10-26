"""Persistence helpers for plant history logs."""

from __future__ import annotations

from collections.abc import Sequence

from sqlmodel import Session, select

from backend.models import Log
from backend.schemas.log import LogCreate
from backend.services.timeutils import utcnow


def list_logs(session: Session, *, plant_id: int, limit: int | None = None) -> Sequence[Log]:
    statement = select(Log).where(Log.plant_id == plant_id).order_by(Log.performed_at.desc())
    if limit is not None:
        statement = statement.limit(limit)
    return session.exec(statement).all()


def create_log(session: Session, plant_id: int, payload: LogCreate) -> Log:
    values = payload.model_dump(exclude_none=True)
    performed_at = values.pop("performed_at", None) or utcnow()
    log = Log(plant_id=plant_id, performed_at=performed_at, **values)
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


def get_log(session: Session, log_id: int) -> Log | None:
    return session.get(Log, log_id)
