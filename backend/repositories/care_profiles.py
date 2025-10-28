"""Repository for managing care profiles."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlmodel import Session

from backend.models import (
    CareCadenceType,
    CareProfile,
    CareProfileCreate,
    CareProfileUpdate,
    Plant,
)
from backend.repositories.tasks import TaskRepository
from backend.services.cadence import first_due_on_or_after


class CareProfileRepository:
    """CRUD operations for care profiles."""

    def __init__(self, session: Session):
        self.session = session

    def list(self, *, plant_id: Optional[UUID] = None) -> List[CareProfile]:
        statement = select(CareProfile)
        if plant_id is not None:
            statement = statement.where(CareProfile.plant_id == plant_id)
        statement = statement.order_by(CareProfile.created_at)
        result = self.session.exec(statement)
        return list(result.scalars())

    def get(self, profile_id: UUID) -> CareProfile:
        profile = self.session.get(CareProfile, profile_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Care profile not found.",
                        "field": "id",
                    }
                },
            )
        return profile

    def create(self, payload: CareProfileCreate) -> CareProfile:
        self._ensure_plant_exists(payload.plant_id)
        try:
            profile = CareProfile(**payload.model_dump())
        except ValueError as exc:  # pragma: no cover - defensive validation
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": str(exc),
                        "field": "cadence",
                    }
                },
            ) from exc
        self._validate_profile(profile)
        self.session.add(profile)
        self.session.commit()
        self.session.refresh(profile)

        task_repo = TaskRepository(self.session)
        task_repo.ensure_initial_task(
            profile, due_date=first_due_on_or_after(profile, profile.start_date)
        )
        self.session.refresh(profile)
        return profile

    def update(self, profile: CareProfile, payload: CareProfileUpdate) -> CareProfile:
        data = payload.model_dump(exclude_unset=True)
        schedule_changed = False
        for key, value in data.items():
            if value is None:
                setattr(profile, key, None)
            else:
                setattr(profile, key, value)
            if key in {"cadence_type", "interval_days", "weekly_days", "start_date"}:
                schedule_changed = True
        self._validate_profile(profile)
        profile.updated_at = datetime.now(timezone.utc)
        self.session.add(profile)
        self.session.commit()
        self.session.refresh(profile)

        if schedule_changed:
            TaskRepository(self.session).regenerate_pending_tasks(profile)
        return profile

    def delete(self, profile: CareProfile) -> None:
        task_repo = TaskRepository(self.session)
        task_repo.delete_by_profile(profile.id)
        self.session.delete(profile)
        self.session.commit()

    def _ensure_plant_exists(self, plant_id: UUID) -> None:
        if self.session.get(Plant, plant_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Plant not found.",
                        "field": "plant_id",
                    }
                },
            )

    def _validate_profile(self, profile: CareProfile) -> None:
        if profile.cadence_type == CareCadenceType.INTERVAL and not profile.interval_days:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "interval_days is required for interval cadence",
                        "field": "interval_days",
                    }
                },
            )
        if profile.cadence_type == CareCadenceType.WEEKLY and not profile.weekly_days:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail={
                    "error": {
                        "code": "VALIDATION_ERROR",
                        "message": "weekly_days is required for weekly cadence",
                        "field": "weekly_days",
                    }
                },
            )
