"""API routes for plant photo uploads and deletion."""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Response, UploadFile, status
from sqlmodel import Session

from backend.db import get_session
from backend.models import PhotoRead
from backend.repositories.plants import PlantRepository
from backend.repositories.photos import PhotoRepository
from backend.services.photos import (
    MEDIA_ROOT,
    build_photo_urls,
    delete_photo,
    store_photo_for_plant,
)

router = APIRouter(prefix="/api/v1", tags=["photos"])


@router.post(
    "/plants/{plant_id}/photos",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_plant_photo(
    plant_id: UUID,
    *,
    file: Annotated[UploadFile, File(...)],
    session: Session = Depends(get_session),
):
    plant_repository = PlantRepository(session)
    plant = plant_repository.get(plant_id)
    photo = await store_photo_for_plant(session, plant, file)
    original_url, thumbnail_url = build_photo_urls(photo)
    payload = PhotoRead.model_validate(photo)
    return payload.model_copy(
        update={"original_url": original_url, "thumbnail_url": thumbnail_url}
    )


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_photo(
    photo_id: UUID,
    *,
    session: Session = Depends(get_session),
):
    repository = PhotoRepository(session, MEDIA_ROOT)
    photo = repository.get(photo_id)
    delete_photo(session, photo)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
