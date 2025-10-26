"""Photo upload and management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlmodel import Session

from backend.database import get_session
from backend.models import Plant
from backend.repositories.photos import get_photo
from backend.schemas.photo import PhotoRead
from backend.services.media import delete_photo as delete_photo_media
from backend.services.media import store_photo

router = APIRouter(tags=["photos"])


@router.post(
    "/plants/{plant_id}/photos",
    response_model=PhotoRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_photo(
    plant_id: int,
    *,
    session: Session = Depends(get_session),
    file: UploadFile = File(...),
    caption: str | None = Form(default=None),
) -> PhotoRead:
    """Upload a new photo for a plant."""

    plant = session.get(Plant, plant_id)
    if plant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Plant not found.")
    photo = store_photo(session, plant_id=plant_id, upload=file, caption=caption)
    session.refresh(photo)
    return PhotoRead.model_validate(photo.model_dump())


@router.delete("/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(photo_id: int, session: Session = Depends(get_session)) -> Response:
    """Delete a photo and associated files."""

    photo = get_photo(session, photo_id)
    if photo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Photo not found.")
    delete_photo_media(session, photo)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
