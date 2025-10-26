"""Repository helpers for plants."""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import or_
from sqlmodel import Session, select

from backend.models import Plant
from backend.schemas.plant import PlantCreate, PlantMoveRequest, PlantUpdate
from backend.services.timeutils import utcnow


def list_plants(
    session: Session,
    *,
    village_id: int | None = None,
    query: str | None = None,
    tag: str | None = None,
) -> Sequence[Plant]:
    """Return plants filtered by the provided criteria."""

    statement = select(Plant)
    if village_id is not None:
        statement = statement.where(Plant.village_id == village_id)
    if query:
        like_pattern = f"%{query.lower()}%"
        statement = statement.where(
            or_(
                Plant.name.ilike(like_pattern),
                Plant.species.ilike(like_pattern),
                Plant.variety.ilike(like_pattern),
            )
        )
    statement = statement.order_by(Plant.name)
    plants = session.exec(statement).all()
    if tag:
        plants = [plant for plant in plants if tag in plant.tags]
    return plants


def get_plant(session: Session, plant_id: int) -> Plant | None:
    """Fetch a plant by identifier."""

    return session.get(Plant, plant_id)


def create_plant(session: Session, payload: PlantCreate) -> Plant:
    """Persist a new plant."""

    plant = Plant(**payload.model_dump())
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return plant


def update_plant(session: Session, plant: Plant, payload: PlantUpdate) -> Plant:
    """Update an existing plant."""

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plant, key, value)
    plant.updated_at = utcnow()
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return plant


def move_plant(session: Session, plant: Plant, payload: PlantMoveRequest) -> Plant:
    """Move a plant to a different village."""

    plant.village_id = payload.destination_village_id
    plant.updated_at = utcnow()
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return plant


def delete_plant(session: Session, plant_id: int) -> None:
    """Remove a plant and its dependent records."""

    plant = session.get(Plant, plant_id)
    if plant is None:
        return
    session.delete(plant)
    session.commit()
