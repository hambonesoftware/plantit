from io import BytesIO

from PIL import Image

from backend.services.photos import MEDIA_ROOT


def _image_bytes() -> bytes:
    image = Image.new("RGB", (640, 480), color=(12, 160, 88))
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _create_plant(client):
    village = client.post(
        "/api/v1/villages/",
        json={
            "name": "Photo Village",
            "location": "Somewhere",
            "description": "A village for testing photos.",
        },
    ).json()
    plant = client.post(
        "/api/v1/plants/",
        json={
            "name": "Fern",
            "species": "Pteridophyta",
            "village_id": village["id"],
        },
    ).json()
    return village["id"], plant["id"]


def test_upload_and_delete_photo_updates_viewmodels(client):
    village_id, plant_id = _create_plant(client)
    payload = _image_bytes()
    files = {"file": ("fern.jpg", BytesIO(payload), "image/jpeg")}

    response = client.post(f"/api/v1/plants/{plant_id}/photos", files=files)
    assert response.status_code == 201
    body = response.json()
    assert body["thumbnail_url"].startswith("/media/")
    assert body["original_url"].startswith("/media/")

    original_path = MEDIA_ROOT / body["original_path"]
    thumb_path = MEDIA_ROOT / body["thumbnail_path"]
    assert original_path.exists()
    assert thumb_path.exists()

    village_vm = client.get(f"/api/v1/vm/village/{village_id}").json()
    plant_entry = village_vm["plants"][0]
    assert plant_entry["has_photo"] is True
    assert plant_entry["thumbnail_url"] == body["thumbnail_url"]

    plant_vm = client.get(f"/api/v1/vm/plant/{plant_id}").json()["plant"]
    assert len(plant_vm["photos"]) == 1
    photo_vm = plant_vm["photos"][0]
    assert photo_vm["id"] == body["id"]
    assert photo_vm["thumbnail_url"] == body["thumbnail_url"]
    assert photo_vm["original_url"] == body["original_url"]

    delete_response = client.delete(f"/api/v1/photos/{body['id']}")
    assert delete_response.status_code == 204
    assert not original_path.exists()
    assert not thumb_path.exists()

    village_vm_after = client.get(f"/api/v1/vm/village/{village_id}").json()
    assert village_vm_after["plants"][0]["has_photo"] is False
    assert village_vm_after["plants"][0]["thumbnail_url"] is None

    plant_vm_after = client.get(f"/api/v1/vm/plant/{plant_id}").json()["plant"]
    assert plant_vm_after["photos"] == []
