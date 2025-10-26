"""Database configuration tests."""

from __future__ import annotations

from backend import database


def test_sqlite_engine_sets_busy_timeout() -> None:
    """Ensure the SQLite engine waits long enough for locked databases."""

    engine = database.get_engine()
    with engine.connect() as connection:
        (timeout_ms,) = connection.exec_driver_sql("PRAGMA busy_timeout").one()
    assert timeout_ms == 30000
