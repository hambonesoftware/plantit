"""Add optional image_url column for plant banner images."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Connection


VERSION = "0005_add_plant_images"


def apply(connection: Connection) -> None:
    """Add the image_url column to the plants table when missing."""

    dialect_name = getattr(connection, "dialect", None)
    dialect_name = getattr(dialect_name, "name", "")

    if dialect_name != "sqlite":
        connection.execute(
            text(
                """
                ALTER TABLE plants
                ADD COLUMN IF NOT EXISTS image_url TEXT
                """
            )
        )
        return

    # SQLite only introduced ``ADD COLUMN IF NOT EXISTS`` in v3.35, but
    # our test environment may run an older version. Inspect the existing
    # columns and bail out early when the column is already present so we can
    # safely execute a plain ``ADD COLUMN`` statement.
    result = connection.execute(text("PRAGMA table_info(plants)")).mappings()
    for row in result:
        if row.get("name") == "image_url":
            return

    connection.execute(
        text(
            """
            ALTER TABLE plants
            ADD COLUMN image_url TEXT
            """
        )
    )
