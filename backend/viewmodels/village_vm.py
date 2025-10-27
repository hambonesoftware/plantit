"""Village detail view model construction."""
from __future__ import annotations

from fastapi import HTTPException, status
from uuid import UUID

from sqlmodel import Session, select

from backend.models import Plant, Village


def build_village_vm(session: Session, village_id: UUID) -> dict:
    village = session.get(Village, village_id)
    if village is None:
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
    plants = session.exec(select(Plant).where(Plant.village_id == village_id)).all()
    return {
        "village": {
            "id": str(village.id),
            "name": village.name,
            "location": village.location,
            "description": village.description,
            "created_at": village.created_at.isoformat(),
            "updated_at": village.updated_at.isoformat(),
        },
        "plants": [
            {
                "id": str(plant.id),
                "name": plant.name,
                "species": plant.species,
                "notes": plant.notes,
                "tags": plant.tags,
                "created_at": plant.created_at.isoformat(),
                "updated_at": plant.updated_at.isoformat(),
            }
            for plant in plants
        ],
    }
