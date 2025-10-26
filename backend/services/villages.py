"""Business logic for village operations."""

from __future__ import annotations

from sqlmodel import Session

from backend.models import Village
from backend.repositories import villages as village_repo
from backend.schemas.village import VillageCreate, VillageRead, VillageUpdate


def _serialize(village: Village) -> VillageRead:
    return VillageRead.model_validate(village.model_dump(exclude={"plants"}))


def create_village(session: Session, payload: VillageCreate) -> VillageRead:
    """Create a village and return its serialized representation."""

    village = village_repo.create_village(
        session,
        name=payload.name,
        description=payload.description,
    )
    return _serialize(village)


def list_villages(session: Session) -> list[VillageRead]:
    """Return all villages as serialized models."""

    villages = village_repo.list_villages(session)
    return [_serialize(village) for village in villages]


def get_village(session: Session, village_id: int) -> Village | None:
    """Retrieve a village by identifier."""

    return village_repo.get_village(session, village_id)


def read_village(session: Session, village_id: int) -> VillageRead | None:
    """Fetch and serialize a village."""

    village = village_repo.get_village(session, village_id)
    if village is None:
        return None
    return _serialize(village)


def update_village(session: Session, village_id: int, payload: VillageUpdate) -> VillageRead | None:
    """Update a village and return its serialized form."""

    village = village_repo.get_village(session, village_id)
    if village is None:
        return None
    updated = village_repo.update_village(session, village, payload)
    return _serialize(updated)


def delete_village(session: Session, village_id: int) -> bool:
    """Delete a village by identifier."""

    village = village_repo.get_village(session, village_id)
    if village is None:
        return False
    village_repo.delete_village(session, village)
    return True
