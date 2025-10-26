"""Data access helpers for villages."""

from __future__ import annotations

from sqlmodel import Session, select

from backend.models import Village
from backend.schemas.village import VillageUpdate
from backend.services.timeutils import utcnow


def create_village(session: Session, *, name: str, description: str | None) -> Village:
    """Persist a new village and return the instance."""

    village = Village(name=name, description=description)
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


def update_village(session: Session, village: Village, payload: VillageUpdate) -> Village:
    """Apply partial updates to the given village and persist the changes."""

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(village, key, value)
    village.updated_at = utcnow()
    session.add(village)
    session.commit()
    session.refresh(village)
    return village


def delete_village(session: Session, village: Village) -> None:
    """Remove a village from the database."""

    session.delete(village)
    session.commit()
