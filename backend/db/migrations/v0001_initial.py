"""Initial schema with villages, plants, and tasks."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


VERSION = "0001_initial"


def apply(connection: Connection) -> None:
    """Apply the initial migration."""

    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS villages (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                climate TEXT NOT NULL,
                description TEXT,
                established_at DATE,
                irrigation_type TEXT,
                health_score REAL NOT NULL
            )
            """
        )
    )

    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS plants (
                id TEXT PRIMARY KEY,
                village_id TEXT NOT NULL REFERENCES villages(id) ON DELETE CASCADE,
                display_name TEXT NOT NULL,
                species TEXT NOT NULL,
                stage TEXT NOT NULL,
                last_watered_at TIMESTAMP WITH TIME ZONE,
                health_score REAL NOT NULL,
                notes TEXT
            )
            """
        )
    )

    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
                plant_name TEXT NOT NULL,
                village_name TEXT NOT NULL,
                due_at TIMESTAMP WITH TIME ZONE NOT NULL,
                priority TEXT NOT NULL
            )
            """
        )
    )

    connection.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    )
