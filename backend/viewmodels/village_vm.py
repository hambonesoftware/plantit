"""Village detail view model construction."""

from __future__ import annotations

from collections import defaultdict
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, select

from backend.models import Photo, Plant, Village
from backend.services.photos import build_photo_urls


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
    plant_ids = [plant.id for plant in plants]
    photo_lookup: dict[UUID, list[Photo]] = defaultdict(list)
    if plant_ids:
        photos = session.exec(
            select(Photo)
            .where(Photo.plant_id.in_(plant_ids))
            .order_by(Photo.created_at.desc())
        ).all()
        for photo in photos:
            photo_lookup[photo.plant_id].append(photo)
    return {
        "village": {
            "id": str(village.id),
            "name": village.name,
            "location": village.location,
            "description": village.description,
            "created_at": village.created_at.isoformat(),
            "updated_at": village.updated_at.isoformat(),
        },
        "plants": [_serialize_plant(plant, photo_lookup) for plant in plants],
    }


def _serialize_plant(plant: Plant, photo_lookup: dict[UUID, list[Photo]]) -> dict:
    photos = photo_lookup.get(plant.id, [])
    thumbnail_url = None
    if photos:
        _, thumb = build_photo_urls(photos[0])
        thumbnail_url = thumb
    return {
        "id": str(plant.id),
        "name": plant.name,
        "species": plant.species,
        "notes": plant.notes,
        "tags": plant.tags,
        "created_at": plant.created_at.isoformat(),
        "updated_at": plant.updated_at.isoformat(),
        "has_photo": bool(photos),
        "thumbnail_url": thumbnail_url,
    }
