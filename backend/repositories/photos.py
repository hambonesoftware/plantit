"""Data access helpers for photo entities."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session

from backend.models import Photo


class PhotoRepository:
    """Encapsulates persistence for plant photos."""

    def __init__(self, session: Session, media_root: Path):
        self.session = session
        self.media_root = media_root

    def get(self, photo_id: UUID) -> Photo:
        photo = self.session.get(Photo, photo_id)
        if photo is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Photo not found.",
                        "field": "id",
                    }
                },
            )
        return photo

    def create(self, photo: Photo) -> Photo:
        self.session.add(photo)
        self.session.commit()
        self.session.refresh(photo)
        return photo

    def delete(self, photo: Photo) -> None:
        self.session.delete(photo)

    def remove_files(self, photo: Photo) -> None:
        for relative_path in _iter_paths(photo):
            path = self.media_root / relative_path
            try:
                path.unlink()
            except FileNotFoundError:  # pragma: no cover - defensive cleanup
                continue
        # remove empty parent folders up to media root
        thumb_parent = (self.media_root / photo.thumbnail_path).parent
        self._prune_empty_directories(thumb_parent)

    def _prune_empty_directories(self, start: Path) -> None:
        current = start
        while current != self.media_root and self.media_root in current.parents:
            try:
                current.rmdir()
            except OSError:
                break
            current = current.parent


def _iter_paths(photo: Photo) -> Iterable[Path]:
    yield Path(photo.original_path)
    yield Path(photo.thumbnail_path)
