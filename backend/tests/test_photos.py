"""Tests for photo upload and deletion."""

from __future__ import annotations

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session

from backend import config
from backend.models import Photo, Plant, Village


@pytest.fixture()
def village(session: Session) -> Village:
    village = Village(name="Test Village", description="")
    session.add(village)
    session.commit()
    session.refresh(village)
    return village


@pytest.fixture()
def plant(session: Session, village: Village) -> Plant:
    plant = Plant(village_id=village.id, name="Rose", species="Rosa")
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return plant


def _create_image_bytes(color: tuple[int, int, int] = (255, 0, 0)) -> bytes:
    image = Image.new("RGB", (640, 480), color)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_upload_photo_success(client: TestClient, session: Session, plant: Plant) -> None:
    data = {"caption": "First bloom"}
    files = {"file": ("flower.jpg", _create_image_bytes(), "image/jpeg")}

    response = client.post(f"/api/v1/plants/{plant.id}/photos", data=data, files=files)
    assert response.status_code == 201
    payload = response.json()
    assert payload["plant_id"] == plant.id
    assert payload["caption"] == "First bloom"

    photo = session.get(Photo, payload["id"])
    assert photo is not None

    settings = config.get_settings()
    original = settings.media_root / payload["file_path"]
    thumb = settings.media_root / payload["thumbnail_path"]
    assert original.exists()
    assert thumb.exists()


def test_upload_rejects_invalid_type(client: TestClient, plant: Plant) -> None:
    files = {"file": ("notes.txt", b"hello", "text/plain")}
    response = client.post(f"/api/v1/plants/{plant.id}/photos", files=files)
    assert response.status_code == 415


def test_upload_rejects_oversized(client: TestClient, plant: Plant, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLANTIT_MAX_UPLOAD", "100")
    config.get_settings.cache_clear()
    data = {"caption": "Too big"}
    files = {"file": ("big.jpg", _create_image_bytes(), "image/jpeg")}
    response = client.post(f"/api/v1/plants/{plant.id}/photos", data=data, files=files)
    assert response.status_code == 413
    config.get_settings.cache_clear()


def test_delete_photo_removes_files(client: TestClient, session: Session, plant: Plant) -> None:
    files = {"file": ("flower.jpg", _create_image_bytes(), "image/jpeg")}
    response = client.post(f"/api/v1/plants/{plant.id}/photos", files=files)
    payload = response.json()

    settings = config.get_settings()
    original = settings.media_root / payload["file_path"]
    thumb = settings.media_root / payload["thumbnail_path"]
    assert original.exists()
    assert thumb.exists()

    delete_response = client.delete(f"/api/v1/photos/{payload['id']}")
    assert delete_response.status_code == 204
    assert not original.exists()
    assert not thumb.exists()
    assert session.get(Photo, payload["id"]) is None
