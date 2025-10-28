from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image
from sqlmodel import delete

from backend.models import Photo, Plant, Village
from backend.services.photos import MEDIA_ROOT


def _image_bytes() -> BytesIO:
    image = Image.new("RGB", (320, 240), color=(12, 160, 88))
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer


@pytest.fixture()
def sample_bundle(client):
    village = client.post(
        "/api/v1/villages/",
        json={
            "name": "Export Village",
            "location": "Somewhere",
            "description": "Village for export tests",
        },
    ).json()
    plant = client.post(
        "/api/v1/plants/",
        json={
            "name": "Test Plant",
            "species": "Speciosa",
            "notes": "Loves water",
            "village_id": village["id"],
        },
    ).json()
    files = {"file": ("plant.jpg", _image_bytes(), "image/jpeg")}
    photo = client.post(f"/api/v1/plants/{plant['id']}/photos", files=files).json()
    export_response = client.get("/api/v1/export?scope=all")
    assert export_response.status_code == 200
    bundle = export_response.json()
    return {
        "bundle": bundle,
        "village_id": village["id"],
        "plant_id": plant["id"],
        "photo": photo,
    }


def _clear_database(session):
    session.exec(delete(Photo))
    session.exec(delete(Plant))
    session.exec(delete(Village))
    session.commit()


def test_export_import_round_trip(client, session, sample_bundle):
    bundle = sample_bundle["bundle"]
    village_id = sample_bundle["village_id"]
    plant_id = sample_bundle["plant_id"]

    _clear_database(session)

    import_response = client.post("/api/v1/import", json=bundle)
    assert import_response.status_code == 200
    body = import_response.json()
    assert body["created"]["villages"] == 1
    assert body["created"]["plants"] == 1
    assert body["created"]["photos"] == 1
    assert body["conflicts"] == []

    villages = client.get("/api/v1/villages/").json()
    assert any(v["id"] == village_id for v in villages)

    plant = client.get(f"/api/v1/plants/{plant_id}").json()
    assert plant["id"] == plant_id

    plant_vm = client.get(f"/api/v1/vm/plant/{plant_id}").json()
    assert plant_vm["plant"]["photos"]


def test_import_reports_missing_media(client, session, sample_bundle):
    bundle = sample_bundle["bundle"]
    photo_manifest = bundle.get("media", [])
    for item in photo_manifest:
        path = MEDIA_ROOT / item["relative_path"]
        if path.exists():
            path.unlink()

    _clear_database(session)

    response = client.post("/api/v1/import", json=bundle)
    assert response.status_code == 200
    body = response.json()
    assert body["created"]["photos"] == 0
    assert body["conflicts"], "Expected conflicts when media files are missing"
