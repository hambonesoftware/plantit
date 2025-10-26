from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import status
from sqlmodel import Session, delete, select

from backend.config import get_settings
from backend.models import Log, Photo, Plant, Task, Village
from backend.models.plant import PlantKind
from backend.models.task import TaskCategory, TaskState
from backend.services.timeutils import utcnow


@pytest.fixture()
def sample_data(session: Session) -> dict[str, int]:
    settings = get_settings()
    media_root = settings.media_root
    media_root.mkdir(parents=True, exist_ok=True)

    village = Village(name="Eden", description="Test village", timezone="UTC")
    session.add(village)
    session.commit()
    session.refresh(village)

    plant = Plant(
        village_id=village.id,
        name="Fern",
        species="Pteridophyta",
        kind=PlantKind.herb,
        tags=["shade"],
        care_profile={"watering_interval_days": 4},
    )
    session.add(plant)
    session.commit()
    session.refresh(plant)

    task = Task(
        plant_id=plant.id,
        title="Water Fern",
        category=TaskCategory.watering,
        state=TaskState.pending,
    )
    session.add(task)
    session.commit()
    session.refresh(task)

    log = Log(
        plant_id=plant.id,
        task_id=task.id,
        action="watered",
        notes="Gave a good soak",
        performed_at=utcnow(),
    )
    session.add(log)
    session.commit()
    session.refresh(log)

    photo_dir = media_root / "2025" / "01"
    photo_dir.mkdir(parents=True, exist_ok=True)
    photo_path = photo_dir / "abc.jpg"
    thumbnail_path = photo_dir / "thumb_abc.jpg"
    photo_path.write_bytes(b"test-data")
    thumbnail_path.write_bytes(b"thumb-data")

    photo = Photo(
        plant_id=plant.id,
        filename="abc.jpg",
        file_path=str(photo_path.relative_to(media_root)),
        thumbnail_path=str(thumbnail_path.relative_to(media_root)),
        content_type="image/jpeg",
        size_bytes=9,
        width=100,
        height=100,
        caption="A fern",
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)

    return {
        "village_id": village.id,
        "plant_id": plant.id,
        "task_id": task.id,
        "log_id": log.id,
        "photo_id": photo.id,
        "photo_path": str(photo_path),
    }


def test_export_all_returns_bundle(client, sample_data):
    response = client.get("/api/v1/export")
    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["meta"]["scope"] == "all"
    assert len(payload["villages"]) == 1
    assert len(payload["plants"]) == 1
    assert payload["plants"][0]["name"] == "Fern"
    assert payload["media"][0]["exists"] is True


def test_export_requires_identifier_for_village_scope(client):
    response = client.get("/api/v1/export", params={"scope": "village"})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_import_roundtrip_restores_data(client, session: Session, sample_data):
    export_response = client.get("/api/v1/export")
    bundle = export_response.json()

    for model in (Photo, Log, Task, Plant, Village):
        session.exec(delete(model))
    session.commit()

    import_response = client.post("/api/v1/import", json=bundle)
    assert import_response.status_code == status.HTTP_200_OK
    result = import_response.json()
    assert result["status"] == "success"
    assert result["created"]["plants"] == 1

    plants = session.exec(select(Plant)).all()
    assert len(plants) == 1
    assert plants[0].name == "Fern"


def test_import_reports_missing_media(client, session: Session, sample_data):
    export_response = client.get("/api/v1/export")
    bundle = export_response.json()

    Path(sample_data["photo_path"]).unlink()

    for model in (Photo, Log, Task, Plant, Village):
        session.exec(delete(model))
    session.commit()

    import_response = client.post("/api/v1/import", json=bundle)
    assert import_response.status_code == status.HTTP_200_OK
    result = import_response.json()
    assert result["status"] == "partial"
    assert any("Missing media file" in entry for entry in result["conflicts"])
