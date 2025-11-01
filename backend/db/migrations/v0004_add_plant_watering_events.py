"""Create table for plant watering events."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


VERSION = "0004_add_plant_watering_events"


def apply(connection: Connection) -> None:
    """Create the plant_watering_events table if it does not exist."""

    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS plant_watering_events (
                id TEXT PRIMARY KEY,
                plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
                watered_at DATE NOT NULL,
                recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_plant_watering UNIQUE (plant_id, watered_at)
            )
            """
        )
    )
    connection.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_plant_watering_events_plant_id
            ON plant_watering_events (plant_id)
            """
        )
    )
