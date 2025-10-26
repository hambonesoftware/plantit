"""Tests for search and tag endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from backend.models import Log, Plant, PlantKind, Village
from backend.services import search as search_service


@pytest.fixture()
def seeded_data(session: Session) -> dict[str, object]:
    search_service.ensure_indexes(session)
    village = Village(name="Garden", description="", timezone="UTC")
    session.add(village)
    session.commit()
    session.refresh(village)

    plant = Plant(
        village_id=village.id,
        name="Chocolate Mint",
        species="Mentha",
        kind=PlantKind.herb,
        tags=["herb", "fragrant"],
        notes="Great for tea",
    )
    other = Plant(
        village_id=village.id,
        name="Lemon Balm",
        species="Melissa officinalis",
        kind=PlantKind.herb,
        tags=["herb"],
    )
    session.add(plant)
    session.add(other)
    session.commit()
    session.refresh(plant)
    session.refresh(other)

    log = Log(plant_id=plant.id, action="Watered", notes="Deep soak in morning")
    session.add(log)
    session.commit()
    session.refresh(log)

    search_service.rebuild_indexes(session)
    return {"village": village, "plant": plant, "other": other, "log": log}


def test_search_returns_plants_and_logs(
    client: TestClient, seeded_data: dict[str, object]
) -> None:
    response = client.get("/api/v1/search", params={"q": "Mint"})
    assert response.status_code == 200
    payload = response.json()
    assert any(item["type"] == "plant" and "Chocolate Mint" in item["title"] for item in payload)

    response = client.get("/api/v1/search", params={"q": "Watered"})
    assert response.status_code == 200
    payload = response.json()
    assert any(item["type"] == "log" and "Watered" in item["title"] for item in payload)


def test_search_reflects_updates(
    client: TestClient, session: Session, seeded_data: dict[str, object]
) -> None:
    plant: Plant = seeded_data["plant"]  # type: ignore[assignment]
    plant.name = "Spearmint"
    session.add(plant)
    session.commit()

    response = client.get("/api/v1/search", params={"q": "Spearmint"})
    assert response.status_code == 200
    assert any(item["title"].startswith("Spearmint") for item in response.json())


def test_list_tags_returns_counts(
    client: TestClient, seeded_data: dict[str, object]
) -> None:
    response = client.get("/api/v1/tags")
    assert response.status_code == 200
    payload = response.json()
    herb_entry = next((item for item in payload if item["tag"] == "herb"), None)
    assert herb_entry is not None
    assert herb_entry["count"] == 2
