"""Plant detail view model construction."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, select

from backend.models import CareProfile, Photo, Plant, Task, TaskStatus
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

    care_profiles = session.exec(
        select(CareProfile)
        .where(CareProfile.plant_id == plant_id)
        .order_by(CareProfile.created_at)
    ).all()
    profile_payload = []
    for profile in care_profiles:
        next_task = session.exec(
            select(Task)
            .where(
                Task.care_profile_id == profile.id,
                Task.status == TaskStatus.PENDING,
            )
            .order_by(Task.due_date)
        ).first()
        profile_payload.append(
            {
                "id": str(profile.id),
                "title": profile.title,
                "description": profile.description,
                "cadence": {
                    "type": profile.cadence_type.value,
                    "interval_days": profile.interval_days,
                    "weekly_days": list(profile.weekly_days or []),
                },
                "start_date": profile.start_date.isoformat(),
                "next_due_date": next_task.due_date.isoformat() if next_task else None,
            }
        )

    pending_tasks = session.exec(
        select(Task)
        .where(
            Task.plant_id == plant_id,
            Task.status == TaskStatus.PENDING,
        )
        .order_by(Task.due_date, Task.created_at)
    ).all()
    tasks_payload = [
        {
            "id": str(task.id),
            "title": task.title,
            "due_date": task.due_date.isoformat(),
            "care_profile_id": str(task.care_profile_id) if task.care_profile_id else None,
            "status": task.status.value,
        }
        for task in pending_tasks
    ]

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
        },
        "care_profiles": profile_payload,
        "tasks": {"pending": tasks_payload},
    }
