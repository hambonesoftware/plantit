"""Database utilities for SQLModel."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from backend.config import Settings, get_settings

_engine: Engine | None = None


def _create_engine(settings: Settings) -> Engine:
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, echo=settings.debug, connect_args=connect_args)


def get_engine() -> Engine:
    """Return a singleton SQLModel engine configured from settings."""

    global _engine
    settings = get_settings()
    if _engine is None or str(_engine.url) != settings.database_url:
        _engine = _create_engine(settings)
    return _engine


def create_db_and_tables() -> None:
    """Create database tables if they do not exist."""

    SQLModel.metadata.create_all(get_engine())


@contextmanager
def session_scope() -> Iterator[Session]:
    """Provide a transactional scope around a series of operations."""

    with Session(get_engine()) as session:
        yield session


def get_session() -> Iterator[Session]:
    """FastAPI dependency providing a database session."""

    with Session(get_engine()) as session:
        yield session
