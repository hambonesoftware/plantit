"""Database configuration and session management for Plantit."""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

DATA_DIR = Path(os.getenv("PLANTIT_DATA_DIR", Path(__file__).resolve().parent / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

_DB_FILENAME = os.getenv("PLANTIT_DB_FILENAME", "plantit.db")
DATABASE_URL = os.getenv("PLANTIT_DATABASE_URL") or f"sqlite:///{DATA_DIR / _DB_FILENAME}"

_engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)


def get_engine():
    """Expose the configured SQLAlchemy engine."""
    return _engine


def create_schema(engine: Engine) -> None:
    """Create SQLModel tables and supporting SQLite structures."""

    SQLModel.metadata.create_all(engine)

    if engine.url.get_backend_name() != "sqlite":
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS plant_search
                USING fts5(
                    name,
                    species,
                    notes,
                    tags,
                    tokenize='porter'
                )
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS plants_ai_plant_search
                AFTER INSERT ON plants BEGIN
                    INSERT INTO plant_search(rowid, name, species, notes, tags)
                    VALUES (
                        new.rowid,
                        COALESCE(new.name, ''),
                        COALESCE(new.species, ''),
                        COALESCE(new.notes, ''),
                        COALESCE((
                            SELECT group_concat(value, ' ')
                            FROM json_each(new.tags)
                        ), '')
                    );
                END;
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS plants_au_plant_search
                AFTER UPDATE ON plants BEGIN
                    DELETE FROM plant_search WHERE rowid = old.rowid;
                    INSERT INTO plant_search(rowid, name, species, notes, tags)
                    VALUES (
                        new.rowid,
                        COALESCE(new.name, ''),
                        COALESCE(new.species, ''),
                        COALESCE(new.notes, ''),
                        COALESCE((
                            SELECT group_concat(value, ' ')
                            FROM json_each(new.tags)
                        ), '')
                    );
                END;
                """
            )
        )
        connection.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS plants_ad_plant_search
                AFTER DELETE ON plants BEGIN
                    DELETE FROM plant_search WHERE rowid = old.rowid;
                END;
                """
            )
        )
        connection.execute(text("DELETE FROM plant_search"))
        connection.execute(
            text(
                """
                INSERT INTO plant_search(rowid, name, species, notes, tags)
                SELECT
                    rowid,
                    COALESCE(name, ''),
                    COALESCE(species, ''),
                    COALESCE(notes, ''),
                    COALESCE((
                        SELECT group_concat(value, ' ')
                        FROM json_each(tags)
                    ), '')
                FROM plants
                """
            )
        )


def init_db() -> None:
    """Create all database tables and supporting structures."""

    create_schema(_engine)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional scope around a series of operations."""
    session = Session(_engine)
    try:
        yield session
        session.commit()
    except Exception:  # pragma: no cover - defensive rollback
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a database session."""
    session = Session(_engine)
    try:
        yield session
    finally:
        session.close()


def create_test_engine() -> "Engine":
    """Create an in-memory SQLite engine for testing purposes."""
    return create_engine(
        "sqlite://",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
