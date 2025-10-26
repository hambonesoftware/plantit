"""Repository helpers for task persistence."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date

from sqlalchemy import and_, func, or_
from sqlmodel import Session, select

from backend.models import Plant, Task
from backend.models.task import TaskCategory, TaskState
from backend.schemas.task import TaskBatchUpdate, TaskCreate, TaskUpdate
from backend.services.timeutils import utcnow


def _apply_task_filters(
    statement,
    *,
    plant_id: int | None = None,
    state: TaskState | None = None,
    category: TaskCategory | None = None,
    due_before: date | None = None,
    due_after: date | None = None,
    search: str | None = None,
):
    if plant_id is not None:
        statement = statement.where(Task.plant_id == plant_id)
    if state is not None:
        statement = statement.where(Task.state == state)
    if category is not None:
        statement = statement.where(Task.category == category)
    if due_before is not None:
        statement = statement.where(Task.due_date <= due_before)
    if due_after is not None:
        statement = statement.where(Task.due_date >= due_after)
    if search:
        like = f"%{search.lower()}%"
        statement = statement.where(
            or_(
                func.lower(Task.title).like(like),
                func.lower(Task.description).like(like),
            )
        )
    return statement


def list_tasks(
    session: Session,
    *,
    plant_id: int | None = None,
    state: TaskState | None = None,
    category: TaskCategory | None = None,
    include_completed: bool = True,
    due_before: date | None = None,
    due_after: date | None = None,
    search: str | None = None,
    with_plant: bool = False,
) -> Sequence[Task]:
    statement = select(Task)
    if with_plant:
        statement = statement.join(Plant)
    statement = _apply_task_filters(
        statement,
        plant_id=plant_id,
        state=state,
        category=category,
        due_before=due_before,
        due_after=due_after,
        search=search,
    )
    if not include_completed:
        statement = statement.where(Task.state != TaskState.completed)
    statement = statement.order_by(Task.due_date.is_(None), Task.due_date, Task.id)
    tasks = session.exec(statement).unique().all()
    if with_plant:
        for task in tasks:
            session.refresh(task, attribute_names=["plant"])
    return tasks


def list_tasks_for_ids(session: Session, task_ids: Iterable[int]) -> Sequence[Task]:
    statement = select(Task).where(Task.id.in_(list(task_ids)))
    return session.exec(statement).all()


def get_task(session: Session, task_id: int) -> Task | None:
    return session.get(Task, task_id)


def create_task(session: Session, payload: TaskCreate) -> Task:
    task = Task(**payload.model_dump())
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def update_task(session: Session, task: Task, payload: TaskUpdate) -> Task:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    task.updated_at = utcnow()
    if task.state == TaskState.completed and task.completed_at is None:
        task.completed_at = utcnow()
    elif task.state != TaskState.completed:
        task.completed_at = None
    session.add(task)
    session.commit()
    session.refresh(task)
    return task


def bulk_update_tasks(session: Session, payload: TaskBatchUpdate) -> Sequence[Task]:
    tasks = list_tasks_for_ids(session, payload.task_ids)
    if not tasks:
        return []
    updates = payload.model_dump(exclude={"task_ids"}, exclude_none=True)
    if not updates:
        return tasks
    now = utcnow()
    for task in tasks:
        if "state" in updates:
            task.state = updates["state"]
            task.completed_at = now if updates["state"] == TaskState.completed else None
        if "due_date" in updates:
            task.due_date = updates["due_date"]
        task.updated_at = now
        session.add(task)
    session.commit()
    for task in tasks:
        session.refresh(task)
    return tasks


def has_duplicate_pending_task(
    session: Session,
    *,
    plant_id: int,
    title: str,
    due_date: date | None,
    category: TaskCategory,
) -> bool:
    statement = select(func.count()).select_from(Task).where(
        and_(
            Task.plant_id == plant_id,
            func.lower(Task.title) == title.lower(),
            Task.state == TaskState.pending,
            Task.category == category,
        )
    )
    if due_date is not None:
        statement = statement.where(Task.due_date == due_date)
    count = session.exec(statement).one()
    return count > 0


def ensure_task_for_category(
    session: Session,
    *,
    plant_id: int,
    title: str,
    due_date: date | None,
    category: TaskCategory,
) -> Task:
    statement = select(Task).where(
        and_(
            Task.plant_id == plant_id,
            Task.category == category,
            Task.state == TaskState.pending,
        )
    )
    existing = session.exec(statement).first()
    if existing:
        existing.due_date = due_date
        existing.updated_at = utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
    task = Task(
        plant_id=plant_id,
        title=title,
        category=category,
        due_date=due_date,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return task
