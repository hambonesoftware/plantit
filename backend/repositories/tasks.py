"""Repository helpers for task management."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlmodel import Session

from backend.models import CareProfile, Plant, Task, TaskCreate, TaskStatus, TaskUpdate
from backend.services.cadence import first_due_on_or_after, next_due_after


class TaskRepository:
    """Encapsulates CRUD operations and cadence-aware helpers for tasks."""

    def __init__(self, session: Session):
        self.session = session

    def list(
        self,
        *,
        plant_id: Optional[UUID] = None,
        status_filter: Optional[TaskStatus] = None,
        due_before: Optional[date] = None,
    ) -> List[Task]:
        statement = select(Task)
        if plant_id is not None:
            statement = statement.where(Task.plant_id == plant_id)
        if status_filter is not None:
            statement = statement.where(Task.status == status_filter)
        if due_before is not None:
            statement = statement.where(Task.due_date <= due_before)
        statement = statement.order_by(Task.due_date, Task.created_at)
        result = self.session.exec(statement)
        return list(result.scalars())

    def get(self, task_id: UUID) -> Task:
        task = self.session.get(Task, task_id)
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Task not found.",
                        "field": "id",
                    }
                },
            )
        return task

    def create(self, payload: TaskCreate) -> Task:
        self._ensure_plant_exists(payload.plant_id)
        profile = None
        if payload.care_profile_id is not None:
            profile = self._ensure_profile_exists(payload.care_profile_id)
        task = Task(**payload.model_dump())
        task.status = TaskStatus.PENDING
        if profile is not None and not payload.title:
            task.title = profile.title
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def update(self, task: Task, payload: TaskUpdate) -> Task:
        data = payload.model_dump(exclude_unset=True)
        status_changed = False
        for key, value in data.items():
            if key == "status" and value is not None:
                status_changed = value != task.status
                task.status = value
                continue
            if value is not None:
                setattr(task, key, value)
        if task.status == TaskStatus.COMPLETED:
            if task.completed_at is None:
                task.completed_at = datetime.now(timezone.utc)
        else:
            task.completed_at = None
        task.updated_at = datetime.now(timezone.utc)
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)

        if status_changed and task.status == TaskStatus.COMPLETED:
            self._schedule_follow_up(task)
        return task

    def delete(self, task: Task) -> None:
        self.session.delete(task)
        self.session.commit()

    def delete_by_profile(self, profile_id: UUID) -> None:
        statement = select(Task).where(Task.care_profile_id == profile_id)
        for task in self.session.exec(statement).scalars():
            self.session.delete(task)
        self.session.commit()

    def ensure_initial_task(self, profile: CareProfile, *, due_date: date) -> Task:
        existing = (
            self.session.exec(
                select(Task)
                .where(
                    and_(
                        Task.care_profile_id == profile.id,
                        Task.status == TaskStatus.PENDING,
                    )
                )
                .order_by(Task.due_date)
            )
            .scalars()
            .first()
        )
        if existing:
            return existing
        task = Task(
            title=profile.title,
            notes=profile.description,
            due_date=due_date,
            plant_id=profile.plant_id,
            care_profile_id=profile.id,
        )
        self.session.add(task)
        self.session.commit()
        self.session.refresh(task)
        return task

    def regenerate_pending_tasks(self, profile: CareProfile) -> None:
        statement = select(Task).where(
            and_(Task.care_profile_id == profile.id, Task.status == TaskStatus.PENDING)
        )
        for task in self.session.exec(statement).scalars():
            self.session.delete(task)
        self.session.commit()
        self.ensure_initial_task(
            profile,
            due_date=first_due_on_or_after(profile, date.today()),
        )

    def _schedule_follow_up(self, task: Task) -> None:
        if task.care_profile_id is None:
            return
        profile = self.session.get(CareProfile, task.care_profile_id)
        if profile is None:
            return
        next_due = next_due_after(profile, task.due_date)
        self.session.add(
            Task(
                title=profile.title,
                notes=profile.description,
                due_date=next_due,
                plant_id=profile.plant_id,
                care_profile_id=profile.id,
            )
        )
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

    def _ensure_profile_exists(self, profile_id: UUID) -> CareProfile:
        profile = self.session.get(CareProfile, profile_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Care profile not found.",
                        "field": "care_profile_id",
                    }
                },
            )
        return profile
