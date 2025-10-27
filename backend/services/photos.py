"""Media pipeline helpers for handling plant photos."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Tuple
from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlmodel import Session

from uuid import uuid4

from backend.db import DATA_DIR
from backend.models import Photo, Plant
from backend.repositories.photos import PhotoRepository

MEDIA_ROOT = DATA_DIR / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_THUMBNAIL_SIZE = (480, 480)
_ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}


async def store_photo_for_plant(
    session: Session, plant: Plant, upload: UploadFile
) -> Photo:
    """Persist a new photo for the given plant."""
    contents = await upload.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "EMPTY_UPLOAD",
                    "message": "Uploaded file is empty.",
                    "field": "file",
                }
            },
        )
    if len(contents) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "FILE_TOO_LARGE",
                    "message": "Images must be 10MB or smaller.",
                    "field": "file",
                }
            },
        )

    try:
        image = Image.open(BytesIO(contents))
    except UnidentifiedImageError as exc:  # pragma: no cover - pillow detail
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "UNSUPPORTED_MEDIA_TYPE",
                    "message": "Unsupported image format.",
                    "field": "file",
                }
            },
        ) from exc

    if image.format not in _ALLOWED_FORMATS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "UNSUPPORTED_MEDIA_TYPE",
                    "message": "Images must be JPEG, PNG, or WebP.",
                    "field": "file",
                }
            },
        )

    oriented = ImageOps.exif_transpose(image)
    width, height = oriented.size
    extension = _ALLOWED_FORMATS[image.format]
    content_type = _content_type_for_format(image.format)

    now = datetime.now(timezone.utc)
    year_dir = MEDIA_ROOT / f"{now.year:04d}"
    month_dir = year_dir / f"{now.month:02d}"
    month_dir.mkdir(parents=True, exist_ok=True)

    photo_id = uuid4()

    original_filename = f"{photo_id}{extension}"
    thumbnail_filename = f"thumb_{photo_id}.jpg"
    original_path = month_dir / original_filename
    thumbnail_path = month_dir / thumbnail_filename

    _write_original(original_path, contents)
    _write_thumbnail(thumbnail_path, oriented)

    relative_original = original_path.relative_to(MEDIA_ROOT).as_posix()
    relative_thumbnail = thumbnail_path.relative_to(MEDIA_ROOT).as_posix()

    plant.updated_at = datetime.now(timezone.utc)

    photo = Photo(
        id=photo_id,
        plant_id=plant.id,
        original_path=relative_original,
        thumbnail_path=relative_thumbnail,
        content_type=content_type,
        width=width,
        height=height,
        file_size=len(contents),
    )

    session.add(photo)
    session.add(plant)
    session.commit()
    session.refresh(photo)
    return photo


def _content_type_for_format(image_format: str) -> str:
    return {
        "JPEG": "image/jpeg",
        "PNG": "image/png",
        "WEBP": "image/webp",
    }[image_format]


def _write_original(path: Path, contents: bytes) -> None:
    path.write_bytes(contents)


def _write_thumbnail(path: Path, image: Image.Image) -> None:
    thumbnail = ImageOps.contain(image, _THUMBNAIL_SIZE)
    buffer = BytesIO()
    thumbnail.convert("RGB").save(buffer, format="JPEG", quality=85, optimize=True)
    path.write_bytes(buffer.getvalue())


def delete_photo(session: Session, photo: Photo) -> None:
    repository = PhotoRepository(session, MEDIA_ROOT)
    repository.remove_files(photo)
    repository.delete(photo)
    plant = session.get(Plant, photo.plant_id)
    if plant is not None:
        plant.updated_at = datetime.now(timezone.utc)
        session.add(plant)
    session.commit()


def build_photo_urls(photo: Photo) -> Tuple[str, str]:
    original_url = f"/media/{photo.original_path}"
    thumbnail_url = f"/media/{photo.thumbnail_path}"
    return original_url, thumbnail_url
