"""Plant detail view model construction."""
from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session

from backend.models import Plant


def build_plant_vm(session: Session, plant_id: UUID) -> dict:
    plant = session.get(Plant, plant_id)
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
    return {
        "plant": {
            "id": str(plant.id),
            "village_id": str(plant.village_id),
            "name": plant.name,
            "species": plant.species,
            "notes": plant.notes,
            "tags": plant.tags,
            "created_at": plant.created_at.isoformat(),
            "updated_at": plant.updated_at.isoformat(),
        }
    }
