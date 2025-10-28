"""Home view model construction."""
from __future__ import annotations

from sqlmodel import Session

from backend.services.aggregations import (
    count_plants,
    count_villages,
    recent_plants,
    tasks_overview,
    village_summaries,
)


def build_home_vm(session: Session) -> dict:
    """Return aggregate statistics for the home dashboard."""

    return {
        "villages": {
            "total": count_villages(session),
            "summaries": village_summaries(session),
        },
        "plants": {
            "total": count_plants(session),
            "recent": recent_plants(session),
        },
        "tasks": tasks_overview(session),
    }
