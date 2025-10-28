"""Tests covering global search and tag aggregation APIs."""
from __future__ import annotations

from datetime import datetime, timezone

from backend.models import Plant, Village


def _create_village(session, name="Test Village"):
    village = Village(name=name)
    session.add(village)
    session.commit()
    session.refresh(village)
    return village


def _create_plant(session, village, name="Lavender", **kwargs):
    tags = kwargs.pop("tags", ["perennial", "aromatic"])
    species = kwargs.pop("species", "Lavandula")
    notes = kwargs.pop("notes", "Fragrant")
    plant = Plant(
        village_id=village.id,
        name=name,
        species=species,
        notes=notes,
        tags=tags,
        **kwargs,
    )
    session.add(plant)
    session.commit()
    session.refresh(plant)
    return plant


def test_search_returns_results(client, session):
    village = _create_village(session)
    plant = _create_plant(session, village)

    response = client.get("/api/v1/search", params={"q": "laven"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["query"] == "laven"
    assert payload["results"], "Expected at least one result"
    match = payload["results"][0]
    assert match["id"] == str(plant.id)
    assert match["village"]["id"] == str(village.id)
    assert "perennial" in match["tags"]


def test_search_respects_updates(client, session):
    village = _create_village(session)
    plant = _create_plant(session, village)

    plant.name = "Chamomile"
    plant.updated_at = datetime.now(timezone.utc)
    session.add(plant)
    session.commit()

    response = client.get("/api/v1/search", params={"q": "chamom"})
    assert response.status_code == 200
    payload = response.json()
    assert any(result["id"] == str(plant.id) for result in payload["results"])


def test_search_omits_deleted(client, session):
    village = _create_village(session)
    plant = _create_plant(session, village)

    session.delete(plant)
    session.commit()

    response = client.get("/api/v1/search", params={"q": "lavender"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["results"] == []


def test_tags_endpoint_aggregates_counts(client, session):
    village = _create_village(session)
    _create_plant(session, village, name="Mint", tags=["herb", "perennial"])
    _create_plant(session, village, name="Basil", tags=["herb", "annual"])

    response = client.get("/api/v1/tags")
    assert response.status_code == 200
    payload = response.json()
    tags = {item["name"]: item["count"] for item in payload["tags"]}
    assert tags["herb"] == 2
    assert tags["perennial"] == 1
    assert tags["annual"] == 1


def test_blank_query_returns_validation_error(client):
    response = client.get("/api/v1/search", params={"q": "   "})
    assert response.status_code == 400
    payload = response.json()
    assert payload["error"]["field"] == "q"
