"""Lightweight migration runner used during application startup."""
from __future__ import annotations

from typing import Dict, Iterable, List

from sqlalchemy import text
from sqlalchemy.engine import Engine

from backend.db.migrations import LATEST_VERSION, MIGRATIONS

SCHEMA_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
)
"""


def ensure_migrations(engine: Engine) -> List[str]:
    """Ensure all migrations have been applied to the database.

    Returns the versions that were applied during this invocation.
    """

    applied_now: List[str] = []
    with engine.begin() as connection:
        connection.execute(text(SCHEMA_TABLE_SQL))
        existing = {
            row[0] for row in connection.execute(text("SELECT version FROM schema_migrations"))
        }

        for version, migration in MIGRATIONS:
            if version in existing:
                continue
            migration(connection)
            connection.execute(
                text("INSERT INTO schema_migrations(version) VALUES (:version)"),
                {"version": version},
            )
            applied_now.append(version)

    return applied_now


def get_migration_state(engine: Engine) -> Dict[str, object]:
    """Return the applied and pending migration state."""

    with engine.begin() as connection:
        connection.execute(text(SCHEMA_TABLE_SQL))
        applied = {
            row[0] for row in connection.execute(text("SELECT version FROM schema_migrations"))
        }

    expected = [version for version, _ in MIGRATIONS]
    pending = [version for version in expected if version not in applied]
    return {"applied": sorted(applied), "pending": pending, "latest": LATEST_VERSION}
