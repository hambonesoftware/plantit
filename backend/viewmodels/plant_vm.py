"""Plant detail view model construction."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, select

from backend.models import Photo, Plant
from backend.services.photos import build_photo_urls


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
    photos = session.exec(
        select(Photo)
        .where(Photo.plant_id == plant_id)
        .order_by(Photo.created_at.desc())
    ).all()
    photo_payload = []
    for photo in photos:
        original_url, thumbnail_url = build_photo_urls(photo)
        photo_payload.append(
            {
                "id": str(photo.id),
                "created_at": photo.created_at.isoformat(),
                "width": photo.width,
                "height": photo.height,
                "content_type": photo.content_type,
                "file_size": photo.file_size,
                "original_url": original_url,
                "thumbnail_url": thumbnail_url,
            }
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
            "photos": photo_payload,
        }
    }
