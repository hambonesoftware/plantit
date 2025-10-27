"""Domain services for computing aggregated metrics."""
from __future__ import annotations

from typing import Dict

from sqlalchemy import func, select
from sqlmodel import Session

from backend.models import Plant, Village


def count_villages(session: Session) -> int:
    """Return the number of villages in the system."""
    statement = select(func.count()).select_from(Village)
    return int(session.exec(statement).one()[0])


def count_plants(session: Session) -> int:
    """Return the number of plants in the system."""
    statement = select(func.count()).select_from(Plant)
    return int(session.exec(statement).one()[0])


def village_plant_totals(session: Session) -> Dict[str, int]:
    """Return a mapping of village ID to the number of plants it contains."""
    results: Dict[str, int] = {}
    statement = select(Plant.village_id, func.count()).group_by(Plant.village_id)
    for village_id, total in session.exec(statement):
        results[str(village_id)] = int(total)
    return results
