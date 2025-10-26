from datetime import datetime

from fastapi import status
from sqlmodel import Session, select

from backend.models import Village


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
