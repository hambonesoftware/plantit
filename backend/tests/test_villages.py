from datetime import datetime

import pytest

from fastapi import status
from sqlmodel import Session, select

from backend.models import Village


@pytest.fixture()
def sample_village(session: Session) -> Village:
    village = Village(name="Starter", description="Initial village")
    session.add(village)
    session.commit()
    session.refresh(village)
    return village


def test_post_village_persists_record(client, session: Session) -> None:
    response = client.post(
        "/api/v1/villages",
        json={"name": "Shade Haven", "description": "North window"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    payload = response.json()
    assert payload["name"] == "Shade Haven"
    assert "timezone" not in payload
    assert "id" in payload
    created = session.exec(select(Village).where(Village.name == "Shade Haven")).one()
    assert created.description == "North window"
    assert isinstance(created.created_at, datetime)


def test_post_village_trims_description(client, session: Session) -> None:
    response = client.post(
        "/api/v1/villages",
        json={"name": "Sunny", "description": "   "},
    )
    assert response.status_code == status.HTTP_201_CREATED
    created = session.exec(select(Village).where(Village.name == "Sunny")).one()
    assert created.description is None


def test_get_village_returns_single_record(client, sample_village: Village) -> None:
    response = client.get(f"/api/v1/villages/{sample_village.id}")
    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload["id"] == sample_village.id
    assert payload["name"] == sample_village.name


def test_patch_village_updates_fields(client, session: Session, sample_village: Village) -> None:
    response = client.patch(
        f"/api/v1/villages/{sample_village.id}",
        json={"description": "Updated description"},
    )
    assert response.status_code == status.HTTP_200_OK
    session.refresh(sample_village)
    assert sample_village.description == "Updated description"


def test_delete_village_removes_record(client, session: Session, sample_village: Village) -> None:
    village_id = sample_village.id
    response = client.delete(f"/api/v1/villages/{village_id}")
    assert response.status_code == status.HTTP_204_NO_CONTENT
    session.expire_all()
    assert session.get(Village, village_id) is None
