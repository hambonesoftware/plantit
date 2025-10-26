"""Data access helpers for villages."""

from __future__ import annotations

from sqlmodel import Session, select

from backend.models import Village


def create_village(session: Session, *, name: str, description: str | None, timezone: str) -> Village:
    """Persist a new village and return the instance."""

    village = Village(name=name, description=description, timezone=timezone)
    session.add(village)
    session.commit()
    session.refresh(village)
    return village


def get_village(session: Session, village_id: int) -> Village | None:
    """Fetch a village by its primary key."""

    return session.get(Village, village_id)


def list_villages(session: Session) -> list[Village]:
    """Return all villages ordered by creation time."""

    statement = select(Village).order_by(Village.created_at.asc())
    return list(session.exec(statement))
