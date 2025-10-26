from datetime import datetime

import pytest
from fastapi import status
from sqlmodel import Session, select

from backend.models import Village


def test_post_village_persists_record(client, session: Session):
    response = client.post(
        "/api/v1/villages",
        json={"name": "Shade Haven", "description": "North window", "timezone": "UTC"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    payload = response.json()
    assert payload["name"] == "Shade Haven"
    assert payload["timezone"] == "UTC"
    assert "id" in payload
    created = session.exec(select(Village).where(Village.name == "Shade Haven")).one()
    assert created.description == "North window"
    assert isinstance(created.created_at, datetime)


def test_post_village_trims_description(client, session: Session):
    response = client.post(
        "/api/v1/villages",
        json={"name": "Sunny", "description": "   ", "timezone": "UTC"},
    )
    assert response.status_code == status.HTTP_201_CREATED
    created = session.exec(select(Village).where(Village.name == "Sunny")).one()
    assert created.description is None


@pytest.mark.parametrize("timezone", ["America/New_York", "Europe/Paris", "UTC"])
def test_post_village_accepts_valid_timezone(client, timezone):
    response = client.post(
        "/api/v1/villages",
        json={"name": f"Village {timezone}", "timezone": timezone},
    )
    assert response.status_code == status.HTTP_201_CREATED


def test_post_village_rejects_invalid_timezone(client):
    response = client.post(
        "/api/v1/villages",
        json={"name": "Bad TZ", "timezone": "Not/AZone"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    data = response.json()
    assert data["detail"][0]["loc"][-1] == "timezone"
