"""Pytest fixtures for backend tests."""

from __future__ import annotations

from typing import Iterator

import shutil

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel

from backend.app import create_app
from backend.db import create_test_engine, get_session
from backend.services.photos import MEDIA_ROOT


@pytest.fixture()
def engine():
    engine = create_test_engine()
    SQLModel.metadata.create_all(engine)
    yield engine


@pytest.fixture()
def app(engine):
    app = create_app()

    def override_get_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session
    yield app
    app.dependency_overrides.clear()


@pytest.fixture()
def client(app):
    return TestClient(app)


@pytest.fixture()
def session(engine):
    with Session(engine) as db_session:
        yield db_session


@pytest.fixture(autouse=True)
def clean_media_directory():
    if MEDIA_ROOT.exists():
        shutil.rmtree(MEDIA_ROOT)
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    yield
    if MEDIA_ROOT.exists():
        shutil.rmtree(MEDIA_ROOT)
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
