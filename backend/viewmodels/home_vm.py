"""Home view model construction."""
from __future__ import annotations

from sqlmodel import Session

from backend.services.aggregations import count_plants, count_villages


def build_home_vm(session: Session) -> dict:
    """Return aggregate statistics for the home dashboard."""
    return {
        "villages": {"total": count_villages(session)},
        "plants": {"total": count_plants(session)},
    }
