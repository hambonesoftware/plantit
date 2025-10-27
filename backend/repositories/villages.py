"""Data access helpers for village entities."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import NoResultFound
from sqlmodel import Session, select

from backend.models import Village, VillageCreate, VillageUpdate
from backend.utils.etag import compute_etag


class VillageRepository:
    """Encapsulates CRUD operations for villages."""

    def __init__(self, session: Session):
        self.session = session

    def list(self) -> List[Village]:
        statement = select(Village).order_by(Village.created_at)
        return list(self.session.exec(statement))

    def get(self, village_id: UUID) -> Village:
        statement = select(Village).where(Village.id == village_id)
        try:
            return self.session.exec(statement).one()
        except NoResultFound as exc:  # pragma: no cover - defensive branch
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Village not found.",
                        "field": "id",
                    }
                },
            ) from exc

    def create(self, payload: VillageCreate) -> Village:
        village = Village(**payload.model_dump())
        self.session.add(village)
        self.session.commit()
        self.session.refresh(village)
        return village

    def update(self, village: Village, payload: VillageUpdate) -> Village:
        update_data = payload.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(village, key, value)
        village.updated_at = datetime.now(timezone.utc)
        self.session.add(village)
        self.session.commit()
        self.session.refresh(village)
        return village

    def delete(self, village: Village) -> None:
        self.session.delete(village)
        self.session.commit()

    def compute_list_etag(self) -> str:
        villages = self.list()
        payload = [self._to_serializable(v) for v in villages]
        return compute_etag(payload)

    def compute_entity_etag(self, village: Village) -> str:
        return compute_etag(self._to_serializable(village))

    @staticmethod
    def _to_serializable(village: Village) -> dict:
        return {
            "id": str(village.id),
            "name": village.name,
            "location": village.location,
            "description": village.description,
            "created_at": village.created_at.isoformat(),
            "updated_at": village.updated_at.isoformat(),
        }


def get_village_or_404(repository: VillageRepository, village_id: UUID) -> Village:
    statement = select(Village).where(Village.id == village_id)
    result = repository.session.exec(statement).first()
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Village not found.",
                    "field": "id",
                }
            },
        )
    return result
