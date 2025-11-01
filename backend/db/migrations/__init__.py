"""Simple migration registry used by the lightweight runner."""
from __future__ import annotations

from typing import Callable, List, Tuple

from sqlalchemy.engine import Connection

from . import (
    v0001_initial,
    v0002_updated_at_columns,
    v0003_add_harbor_pineapple,
    v0004_add_plant_watering_events,
)

Migration = Tuple[str, Callable[[Connection], None]]

MIGRATIONS: List[Migration] = [
    (v0001_initial.VERSION, v0001_initial.apply),
    (v0002_updated_at_columns.VERSION, v0002_updated_at_columns.apply),
    (v0003_add_harbor_pineapple.VERSION, v0003_add_harbor_pineapple.apply),
    (v0004_add_plant_watering_events.VERSION, v0004_add_plant_watering_events.apply),
]

LATEST_VERSION = MIGRATIONS[-1][0]
