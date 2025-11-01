"""Add extended plant tracking fields to the plants table."""
from __future__ import annotations

from typing import Iterable

from sqlalchemy import text
from sqlalchemy.engine import Connection


VERSION = "0006_add_plant_tracking_fields"


_COLUMNS: Iterable[tuple[str, str]] = (
    ("family", "TEXT"),
    ("plant_origin", "TEXT"),
    ("natural_habitat", "TEXT"),
    ("room", "TEXT"),
    ("sunlight", "TEXT"),
    ("pot_size", "TEXT"),
    ("purchased_on", "DATE"),
    ("last_watered", "DATE"),
    ("last_repotted", "DATE"),
    ("dormancy", "TEXT"),
    ("water_average", "TEXT"),
    ("amount", "TEXT"),
    ("activity_log", "JSON"),
)


def apply(connection: Connection) -> None:
    """Add the new tracking columns when missing."""

    dialect_name = getattr(getattr(connection, "dialect", None), "name", "")

    if dialect_name != "sqlite":
        for column, column_type in _COLUMNS:
            connection.execute(
                text(
                    "\n".join(
                        [
                            "ALTER TABLE plants",
                            f"ADD COLUMN IF NOT EXISTS {column} {column_type}",
                        ]
                    )
                )
            )
        return

    result = connection.execute(text("PRAGMA table_info(plants)")).mappings()
    existing = {row.get("name") for row in result}

    for column, column_type in _COLUMNS:
        if column in existing:
            continue
        connection.execute(
            text(
                "\n".join(
                    [
                        "ALTER TABLE plants",
                        f"ADD COLUMN {column} {column_type}",
                    ]
                )
            )
        )
