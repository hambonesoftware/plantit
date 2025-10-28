"""API endpoints for exporting and importing Plantit data."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlmodel import Session, select

from backend.db import get_session
from backend.models import Photo, Plant, Village
from backend.services.photos import MEDIA_ROOT
from backend.utils.etag import compute_etag

router = APIRouter(prefix="/api/v1", tags=["export-import"])

Scope = Literal["all", "village", "plant"]


def _serialize_village(village: Village) -> Dict[str, object]:
    return {
        "id": str(village.id),
        "name": village.name,
        "location": village.location,
        "description": village.description,
        "created_at": village.created_at.isoformat(),
        "updated_at": village.updated_at.isoformat(),
    }


def _serialize_plant(plant: Plant) -> Dict[str, object]:
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


def _serialize_photo(photo: Photo) -> Dict[str, object]:
    return {
        "id": str(photo.id),
        "plant_id": str(photo.plant_id),
        "original_path": photo.original_path,
        "thumbnail_path": photo.thumbnail_path,
        "content_type": photo.content_type,
        "width": photo.width,
        "height": photo.height,
        "file_size": photo.file_size,
        "created_at": photo.created_at.isoformat(),
    }


def _media_manifest(photos: List[Photo]) -> List[Dict[str, object]]:
    manifest: Dict[str, Dict[str, object]] = {}
    for photo in photos:
        manifest[photo.original_path] = {
            "relative_path": photo.original_path,
            "content_type": photo.content_type,
            "size": photo.file_size,
        }
        manifest[photo.thumbnail_path] = {
            "relative_path": photo.thumbnail_path,
            "content_type": "image/jpeg",
            "size": None,
        }
    return list(manifest.values())


def _parse_scope(scope: Scope, entity_id: Optional[UUID]) -> None:
    if scope in {"village", "plant"} and entity_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "id query parameter is required for this scope.",
                    "field": "id",
                }
            },
        )


def _parse_datetime(value: str, field: str) -> datetime:
    try:
        if value.endswith("Z"):
            value = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_DATETIME",
                    "message": f"Invalid datetime for {field}.",
                    "field": field,
                }
            },
        ) from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


@router.get("/export")
def export_data(
    *,
    scope: Scope = Query("all"),
    id: Optional[UUID] = Query(default=None),
    response: Response,
    session: Session = Depends(get_session),
):
    _parse_scope(scope, id)

    villages: List[Village] = []
    plants: List[Plant] = []
    photos: List[Photo] = []

    if scope == "all":
        villages = list(session.exec(select(Village).order_by(Village.created_at)))
        plants = list(session.exec(select(Plant).order_by(Plant.created_at)))
        photos = list(session.exec(select(Photo).order_by(Photo.created_at)))
    elif scope == "village":
        village = session.get(Village, id)
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
        villages = [village]
        plants = list(
            session.exec(select(Plant).where(Plant.village_id == village.id))
        )
        plant_ids = [plant.id for plant in plants]
        if plant_ids:
            photos = list(
                session.exec(select(Photo).where(Photo.plant_id.in_(plant_ids)))
            )
    else:  # scope == "plant"
        plant = session.get(Plant, id)
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
        plants = [plant]
        parent_village = session.get(Village, plant.village_id)
        if parent_village:
            villages = [parent_village]
        photos = list(session.exec(select(Photo).where(Photo.plant_id == plant.id)))

    bundle = {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "scope": scope,
        "villages": [_serialize_village(v) for v in villages],
        "plants": [_serialize_plant(p) for p in plants],
        "photos": [_serialize_photo(photo) for photo in photos],
        "media": _media_manifest(photos),
    }

    response.headers["ETag"] = compute_etag(bundle)
    return bundle


@router.post("/import")
def import_data(
    payload: Dict[str, object],
    *,
    session: Session = Depends(get_session),
):
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_PAYLOAD",
                    "message": "Import payload must be a JSON object.",
                    "field": None,
                }
            },
        )

    created = {"villages": 0, "plants": 0, "photos": 0}
    updated = {"villages": 0, "plants": 0, "photos": 0}
    conflicts: List[Dict[str, object]] = []

    villages_data = payload.get("villages", []) or []
    plants_data = payload.get("plants", []) or []
    photos_data = payload.get("photos", []) or []

    villages_seen: Dict[UUID, Village] = {}

    for item in villages_data:
        village_id = UUID(item["id"])
        existing = session.get(Village, village_id)
        created_at = _parse_datetime(item["created_at"], "villages.created_at")
        updated_at = _parse_datetime(item["updated_at"], "villages.updated_at")
        if existing:
            existing.name = item.get("name")
            existing.location = item.get("location")
            existing.description = item.get("description")
            existing.created_at = created_at
            existing.updated_at = updated_at
            session.add(existing)
            updated["villages"] += 1
            villages_seen[village_id] = existing
        else:
            village = Village(
                id=village_id,
                name=item.get("name"),
                location=item.get("location"),
                description=item.get("description"),
                created_at=created_at,
                updated_at=updated_at,
            )
            session.add(village)
            created["villages"] += 1
            villages_seen[village_id] = village

    session.flush()

    plants_seen: Dict[UUID, Plant] = {}

    for item in plants_data:
        plant_id = UUID(item["id"])
        village_id = UUID(item["village_id"])
        village = villages_seen.get(village_id) or session.get(Village, village_id)
        if village is None:
            conflicts.append(
                {
                    "type": "plant",
                    "id": str(plant_id),
                    "reason": f"Missing village {village_id} for plant.",
                }
            )
            continue
        created_at = _parse_datetime(item["created_at"], "plants.created_at")
        updated_at = _parse_datetime(item["updated_at"], "plants.updated_at")
        existing = session.get(Plant, plant_id)
        if existing:
            existing.name = item.get("name")
            existing.species = item.get("species")
            existing.notes = item.get("notes")
            existing.tags = list(item.get("tags", []))
            existing.village_id = village_id
            existing.created_at = created_at
            existing.updated_at = updated_at
            session.add(existing)
            updated["plants"] += 1
            plants_seen[plant_id] = existing
        else:
            plant = Plant(
                id=plant_id,
                village_id=village_id,
                name=item.get("name"),
                species=item.get("species"),
                notes=item.get("notes"),
                tags=list(item.get("tags", [])),
                created_at=created_at,
                updated_at=updated_at,
            )
            session.add(plant)
            created["plants"] += 1
            plants_seen[plant_id] = plant

    session.flush()

    for item in photos_data:
        photo_id = UUID(item["id"])
        plant_id = UUID(item["plant_id"])
        plant = plants_seen.get(plant_id) or session.get(Plant, plant_id)
        if plant is None:
            conflicts.append(
                {
                    "type": "photo",
                    "id": str(photo_id),
                    "reason": f"Missing plant {plant_id} for photo.",
                }
            )
            continue
        original_path = item["original_path"]
        thumbnail_path = item["thumbnail_path"]
        original_file = MEDIA_ROOT / original_path
        thumbnail_file = MEDIA_ROOT / thumbnail_path
        if not original_file.exists() or not thumbnail_file.exists():
            conflicts.append(
                {
                    "type": "photo",
                    "id": str(photo_id),
                    "reason": "Referenced media files are missing on disk.",
                }
            )
            continue
        created_at = _parse_datetime(item["created_at"], "photos.created_at")
        existing = session.get(Photo, photo_id)
        if existing:
            existing.plant_id = plant_id
            existing.original_path = original_path
            existing.thumbnail_path = thumbnail_path
            existing.content_type = item.get("content_type")
            existing.width = item.get("width")
            existing.height = item.get("height")
            existing.file_size = item.get("file_size")
            existing.created_at = created_at
            session.add(existing)
            updated["photos"] += 1
        else:
            photo = Photo(
                id=photo_id,
                plant_id=plant_id,
                original_path=original_path,
                thumbnail_path=thumbnail_path,
                content_type=item.get("content_type"),
                width=item.get("width"),
                height=item.get("height"),
                file_size=item.get("file_size"),
                created_at=created_at,
            )
            session.add(photo)
            created["photos"] += 1

    session.commit()

    return {
        "created": created,
        "updated": updated,
        "conflicts": conflicts,
    }


__all__ = ["router"]
