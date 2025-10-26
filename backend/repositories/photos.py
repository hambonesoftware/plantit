"""Photo persistence helpers."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Iterable

from sqlmodel import Session, select

from backend.models import Photo


def create_photo(session: Session, photo: Photo) -> Photo:
    """Persist a new photo record."""

    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


def get_photo(session: Session, photo_id: int) -> Photo | None:
    """Return a photo by identifier."""

    return session.get(Photo, photo_id)


def delete_photo(session: Session, photo: Photo) -> None:
    """Delete a photo entry."""

    session.delete(photo)
    session.commit()


def list_photos_for_plants(session: Session, plant_ids: Iterable[int]) -> Sequence[Photo]:
    """Return photos associated with the provided plants."""

    statement = select(Photo).where(Photo.plant_id.in_(list(plant_ids)))
    return session.exec(statement).all()
