"""Utilities for handling media uploads."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlmodel import Session

from backend.config import Settings, get_settings
from backend.models import Photo
from backend.repositories.photos import create_photo
from backend.services.timeutils import utcnow

_ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
}


def _ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _extract_captured_at(image: Image.Image) -> datetime | None:
    exif = image.getexif()
    if not exif:
        return None
    for tag_name in (36867, 36868, 306):
        value = exif.get(tag_name)
        if not value:
            continue
        try:
            parsed = datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
            return parsed.replace(tzinfo=utcnow().tzinfo)
        except ValueError:
            continue
    return None


def _thumbnail(image: Image.Image) -> Image.Image:
    thumb = image.copy()
    thumb = ImageOps.exif_transpose(thumb)
    thumb.thumbnail((512, 512), Image.Resampling.LANCZOS)
    if thumb.mode not in ("RGB", "L"):
        thumb = thumb.convert("RGB")
    return thumb


def store_photo(
    session: Session,
    *,
    plant_id: int,
    upload: UploadFile,
    caption: str | None = None,
    settings: Settings | None = None,
) -> Photo:
    """Validate, persist, and register an uploaded photo."""

    cfg = settings or get_settings()
    raw = upload.file.read()
    if len(raw) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty upload.")
    if len(raw) > cfg.max_upload_size:
        raise HTTPException(
            status.HTTP_413_CONTENT_TOO_LARGE, detail="File too large."
        )

    try:
        image = Image.open(BytesIO(raw))
    except UnidentifiedImageError as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported image type."
        ) from exc

    image_format = (image.format or "").upper()
    if image_format not in _ALLOWED_FORMATS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported image type."
        )

    image = ImageOps.exif_transpose(image)
    width, height = image.size

    extension = _ALLOWED_FORMATS[image_format]

    captured_at = _extract_captured_at(image) or utcnow()

    base_dir = cfg.media_root / f"{captured_at.year:04d}" / f"{captured_at.month:02d}"
    _ensure_directory(base_dir)

    photo_id = uuid4().hex
    original_filename = f"{photo_id}{extension}"
    original_path = base_dir / original_filename
    thumbnail_filename = f"thumb_{photo_id}.jpg"
    thumbnail_path = base_dir / thumbnail_filename

    image.save(original_path, format=image_format)

    thumb = _thumbnail(image)
    thumb.save(thumbnail_path, format="JPEG", quality=85)

    photo = Photo(
        plant_id=plant_id,
        filename=original_filename,
        file_path=str(original_path.relative_to(cfg.media_root)),
        thumbnail_path=str(thumbnail_path.relative_to(cfg.media_root)),
        content_type=upload.content_type or f"image/{image_format.lower()}",
        size_bytes=len(raw),
        width=width,
        height=height,
        caption=caption,
        captured_at=captured_at,
    )
    return create_photo(session, photo)


def delete_photo(session: Session, photo: Photo, settings: Settings | None = None) -> None:
    """Remove a photo and associated files."""

    cfg = settings or get_settings()
    base = cfg.media_root.resolve()
    for rel_path in (photo.file_path, photo.thumbnail_path):
        full_path = (cfg.media_root / rel_path).resolve()
        if base not in full_path.parents and full_path != base:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid media path.")
        if full_path.exists():
            full_path.unlink()
    session.delete(photo)
    session.commit()
