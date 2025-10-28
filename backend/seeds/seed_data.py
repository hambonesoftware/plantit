"""Seed script for loading demo data into the database."""
from __future__ import annotations

from typing import Sequence

from sqlmodel import Session, select

from backend.db import get_engine
from backend.models import CareProfile, CareProfileCreate, CareCadenceType, Plant, Village
from backend.repositories.care_profiles import CareProfileRepository


VILLAGE_DATA = [
    {
        "name": "Evergreen Terrace",
        "location": "Portland",
        "description": "Community garden with a focus on native plants.",
    },
    {
        "name": "Sunnydale Allotments",
        "location": "Austin",
        "description": "Volunteer-run plots for seasonal produce.",
    },
]

PLANT_DATA = [
    {
        "name": "Lavender",
        "species": "Lavandula",
        "notes": "Fragrant perennial attracting pollinators.",
        "tags": ["perennial", "pollinator"],
    },
    {
        "name": "Cherry Tomato",
        "species": "Solanum lycopersicum",
        "notes": "High-yield hybrid for summer harvests.",
        "tags": ["annual", "edible"],
    },
]

CARE_PROFILE_DATA = [
    {
        "title": "Water deeply",
        "cadence_type": CareCadenceType.INTERVAL,
        "interval_days": 3,
    },
    {
        "title": "Harvest",
        "cadence_type": CareCadenceType.WEEKLY,
        "weekly_days": [2, 5],
    },
]


def _ensure_villages(session: Session) -> Sequence[Village]:
    existing = {village.name: village for village in session.exec(select(Village))}
    created: list[Village] = []
    for record in VILLAGE_DATA:
        if record["name"] in existing:
            created.append(existing[record["name"]])
            continue
        village = Village(**record)
        session.add(village)
        session.commit()
        session.refresh(village)
        created.append(village)
    return created


def _ensure_plants(session: Session, villages: Sequence[Village]) -> None:
    if not villages:
        return
    village_cycle = list(villages)
    existing_names = {plant.name for plant in session.exec(select(Plant.name))}
    for index, record in enumerate(PLANT_DATA):
        if record["name"] in existing_names:
            continue
        plant = Plant(
            village_id=village_cycle[index % len(village_cycle)].id,
            **record,
        )
        session.add(plant)
        session.commit()


def _ensure_care_profiles(session: Session) -> None:
    plants = list(session.exec(select(Plant).order_by(Plant.created_at)))
    if not plants:
        return
    repository = CareProfileRepository(session)
    for plant, config in zip(plants, CARE_PROFILE_DATA):
        existing = session.exec(
            select(CareProfile)
            .where(CareProfile.plant_id == plant.id)
            .where(CareProfile.title == config["title"])
        ).first()
        if existing:
            continue
        payload = CareProfileCreate(plant_id=plant.id, **config)
        repository.create(payload)


def run() -> None:
    engine = get_engine()
    with Session(engine) as session:
        villages = _ensure_villages(session)
        _ensure_plants(session, villages)
        _ensure_care_profiles(session)


if __name__ == "__main__":
    run()
