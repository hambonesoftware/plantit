"""Simple migration registry used by the lightweight runner."""
from __future__ import annotations

from typing import Callable, List, Tuple

from sqlalchemy.engine import Connection

from . import v0001_initial

Migration = Tuple[str, Callable[[Connection], None]]

MIGRATIONS: List[Migration] = [
    (v0001_initial.VERSION, v0001_initial.apply),
]

LATEST_VERSION = MIGRATIONS[-1][0]
