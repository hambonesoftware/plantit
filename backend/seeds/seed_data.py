"""Seed script for loading demo data into the database."""
from __future__ import annotations

from typing import Sequence

from sqlmodel import Session, select

from backend.db import get_engine
from backend.models import Plant, Village


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


def run() -> None:
    engine = get_engine()
    with Session(engine) as session:
        villages = _ensure_villages(session)
        _ensure_plants(session, villages)


if __name__ == "__main__":
    run()
