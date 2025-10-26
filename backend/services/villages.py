"""Business logic for village operations."""

from __future__ import annotations

from sqlmodel import Session

from backend.models import Village
from backend.repositories import villages as village_repo
from backend.schemas.village import VillageCreate, VillageRead


def create_village(session: Session, payload: VillageCreate) -> VillageRead:
    """Create a village and return its serialized representation."""

    village = village_repo.create_village(
        session,
        name=payload.name,
        description=payload.description,
    )
    return VillageRead.model_validate(village.model_dump(exclude={"plants"}))


def list_villages(session: Session) -> list[VillageRead]:
    """Return all villages as serialized models."""

    villages = village_repo.list_villages(session)
    return [VillageRead.model_validate(village.model_dump(exclude={"plants"})) for village in villages]


def get_village(session: Session, village_id: int) -> Village | None:
    """Retrieve a village by identifier."""

    return village_repo.get_village(session, village_id)
