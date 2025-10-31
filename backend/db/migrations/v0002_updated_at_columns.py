from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


VERSION = "0002_updated_at_columns"


def apply(connection: Connection) -> None:
    """Add ``updated_at`` columns with optimistic concurrency defaults."""

    def _ensure_updated_at(table_name: str) -> None:
        columns = {column["name"] for column in inspect(connection).get_columns(table_name)}
        if "updated_at" in columns:
            return

        if connection.dialect.name == "sqlite":
            ddl = text(
                f"""
                ALTER TABLE {table_name}
                ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP)
                """
            )
        else:
            ddl = text(
                f"""
                ALTER TABLE {table_name}
                ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE
                NOT NULL DEFAULT CURRENT_TIMESTAMP
                """
            )

        connection.execute(ddl)
        connection.execute(
            text(
                f"UPDATE {table_name} SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"
            )
        )

    _ensure_updated_at("villages")
    _ensure_updated_at("plants")
