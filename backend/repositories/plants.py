"""Data access helpers for plant entities."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from backend.models import Plant, PlantCreate, PlantUpdate, Village
from backend.utils.etag import compute_etag


class PlantRepository:
    """Encapsulates CRUD operations for plants."""

    def __init__(self, session: Session):
        self.session = session

    def list(
        self,
        *,
        village_id: Optional[UUID] = None,
        query: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> List[Plant]:
        statement = select(Plant)
        if village_id is not None:
            statement = statement.where(Plant.village_id == village_id)
        if query is not None:
            like_term = f"%{query.lower()}%"
            statement = statement.where(
                (Plant.name.ilike(like_term)) | (Plant.species.ilike(like_term))
            )
        statement = statement.order_by(Plant.created_at)
        results = list(self.session.exec(statement))
        if tag is not None:
            results = [plant for plant in results if tag in (plant.tags or [])]
        return results

    def get(self, plant_id: UUID) -> Plant:
        plant = self.session.get(Plant, plant_id)
        if plant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Plant not found.",
                        "field": "id",
                    }
                },
            )
        return plant

    def create(self, payload: PlantCreate) -> Plant:
        self._ensure_village_exists(payload.village_id)
        plant = Plant(**payload.model_dump())
        self.session.add(plant)
        try:
            self.session.commit()
        except IntegrityError as exc:
            self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": {
                        "code": "FOREIGN_KEY_VIOLATION",
                        "message": "Invalid village reference for plant.",
                        "field": "village_id",
                    }
                },
            ) from exc
        self.session.refresh(plant)
        return plant

    def update(self, plant: Plant, payload: PlantUpdate) -> Plant:
        data = payload.model_dump(exclude_unset=True)
        if "village_id" in data:
            self._ensure_village_exists(data["village_id"])
        for key, value in data.items():
            setattr(plant, key, value)
        plant.updated_at = datetime.now(timezone.utc)
        self.session.add(plant)
        self.session.commit()
        self.session.refresh(plant)
        return plant

    def delete(self, plant: Plant) -> None:
        self.session.delete(plant)
        self.session.commit()

    def compute_list_etag(
        self,
        *,
        village_id: Optional[UUID] = None,
        query: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> str:
        plants = self.list(village_id=village_id, query=query, tag=tag)
        payload = [self._to_serializable(plant) for plant in plants]
        return compute_etag(payload)

    def compute_entity_etag(self, plant: Plant) -> str:
        return compute_etag(self._to_serializable(plant))

    @staticmethod
    def _to_serializable(plant: Plant) -> dict:
        return {
            "id": str(plant.id),
            "village_id": str(plant.village_id),
            "name": plant.name,
            "species": plant.species,
            "notes": plant.notes,
            "tags": list(plant.tags or []),
            "created_at": plant.created_at.isoformat(),
            "updated_at": plant.updated_at.isoformat(),
        }

    def _ensure_village_exists(self, village_id: UUID) -> None:
        if self.session.get(Village, village_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Village not found.",
                        "field": "village_id",
                    }
                },
            )
