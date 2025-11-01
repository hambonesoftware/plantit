"""Static fixtures derived from the canonical seed data."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Sequence

from backend.data import seed_content

__all__ = [
    "DASHBOARD_PAYLOAD",
    "EXPORT_BUNDLE",
    "HELLO_PAYLOAD",
    "HEALTH_PAYLOAD",
    "TODAY_TASKS_RESPONSE",
    "VILLAGE_DETAIL_BY_ID",
    "VILLAGE_PLANTS_BY_ID",
    "VILLAGE_SUMMARIES",
    "PLANT_DETAIL_BY_ID",
    "PLANT_TIMELINE_BY_ID",
]


def _summary_for_village(village: Dict[str, object], *, plant_count: int) -> Dict[str, object]:
    return {
        "id": village["id"],
        "name": village["name"],
        "climate": village["climate"],
        "plantCount": plant_count,
        "healthScore": village["health_score"],
        "updatedAt": village.get("updated_at", "2024-04-12T08:30:00Z"),
    }


def _plant_payload(plant: Dict[str, object]) -> Dict[str, object]:
    return {
        "id": plant["id"],
        "displayName": plant["display_name"],
        "species": plant["species"],
        "stage": plant["stage"],
        "lastWateredAt": plant["last_watered_at"],
        "healthScore": plant["health_score"],
        "notes": plant.get("notes"),
        "updatedAt": plant.get("updated_at", "2024-04-12T08:30:00Z"),
    }


def _predict_next_watering(history: Sequence[date]) -> date | None:
    unique_sorted = sorted({value for value in history if isinstance(value, date)})
    count = len(unique_sorted)
    if count < 2:
        return None

    indices = list(range(count))
    ordinals = [value.toordinal() for value in unique_sorted]
    mean_index = sum(indices) / count
    mean_ordinal = sum(ordinals) / count
    denominator = sum((index - mean_index) ** 2 for index in indices)
    if denominator == 0:
        interval = max(1, ordinals[-1] - ordinals[-2])
        return unique_sorted[-1] + timedelta(days=interval)

    numerator = sum(
        (index - mean_index) * (ordinal - mean_ordinal)
        for index, ordinal in zip(indices, ordinals)
    )
    slope = numerator / denominator
    intercept = mean_ordinal - slope * mean_index
    predicted = slope * count + intercept
    rounded = round(predicted)
    minimum_next = ordinals[-1] + 1
    target = max(minimum_next, rounded)
    return date.fromordinal(target)


def _watering_payload(plant_id: str) -> Dict[str, object]:
    raw_dates = seed_content.PLANT_WATERINGS.get(plant_id, [])
    parsed_dates: List[date] = []
    for value in raw_dates:
        try:
            parsed_dates.append(date.fromisoformat(value))
        except ValueError:
            continue
    parsed_dates = sorted(parsed_dates)
    history = [value.isoformat() for value in parsed_dates]
    next_date = _predict_next_watering(parsed_dates)
    today = date.today().isoformat()
    return {
        "history": history,
        "nextWateringDate": next_date.isoformat() if next_date else None,
        "hasWateringToday": today in history,
    }


# Villages -------------------------------------------------------------------

_plants_by_village: Dict[str, List[Dict[str, object]]] = {}
for plant in seed_content.PLANTS:
    _plants_by_village.setdefault(plant["village_id"], []).append(plant)

VILLAGE_SUMMARIES: Sequence[Dict[str, object]] = [
    _summary_for_village(village, plant_count=len(_plants_by_village.get(village["id"], ())))
    for village in seed_content.VILLAGES
]

VILLAGE_DETAIL_BY_ID: Dict[str, Dict[str, object]] = {}
for village in seed_content.VILLAGES:
    summary = _summary_for_village(village, plant_count=len(_plants_by_village.get(village["id"], ())))
    VILLAGE_DETAIL_BY_ID[village["id"]] = {
        **summary,
        "description": village["description"],
        "establishedAt": village["established_at"],
        "irrigationType": village["irrigation_type"],
    }

VILLAGE_PLANTS_BY_ID: Dict[str, List[Dict[str, object]]] = {
    village_id: [_plant_payload(plant) for plant in plants]
    for village_id, plants in _plants_by_village.items()
}


# Plant detail ---------------------------------------------------------------

_village_name_by_id = {village["id"]: village["name"] for village in seed_content.VILLAGES}

PLANT_DETAIL_BY_ID: Dict[str, Dict[str, object]] = {
    plant["id"]: {
        "id": plant["id"],
        "displayName": plant["display_name"],
        "species": plant["species"],
        "villageId": plant["village_id"],
        "villageName": _village_name_by_id[plant["village_id"]],
        "lastWateredAt": plant["last_watered_at"],
        "healthScore": plant["health_score"],
        "notes": plant["notes"],
        "updatedAt": plant.get("updated_at", "2024-04-12T08:30:00Z"),
        "watering": _watering_payload(plant["id"]),
    }
    for plant in seed_content.PLANTS
}

PLANT_TIMELINE_BY_ID: Dict[str, List[Dict[str, object]]] = seed_content.PLANT_TIMELINE


# Dashboard ------------------------------------------------------------------

HELLO_PAYLOAD = {"message": "Hello, Plantit"}
HEALTH_PAYLOAD = {"status": "ok", "checks": {"db": "ok"}}

TOTAL_PLANTS = sum(len(plants) for plants in _plants_by_village.values())

DASHBOARD_PAYLOAD = {
    "summary": {
        "totalPlants": TOTAL_PLANTS,
        "activeVillages": len(seed_content.VILLAGES),
        "successRate": round(
            sum(plant["health_score"] for plant in seed_content.PLANTS) / TOTAL_PLANTS, 2
        ),
        "upcomingTasks": len(seed_content.TODAY_TASKS),
    },
    "alerts": seed_content.DASHBOARD_ALERTS,
    "lastUpdated": "2024-04-12T08:30:00Z",
}


# Tasks ----------------------------------------------------------------------

TODAY_TASKS_RESPONSE = {
    "tasks": [
        {
            "id": task["id"],
            "type": task["type"],
            "plantId": task["plant_id"],
            "plantName": task["plant_name"],
            "villageName": task["village_name"],
            "dueAt": task["due_at"],
            "priority": task["priority"],
        }
        for task in seed_content.TODAY_TASKS
    ],
    "emptyStateMessage": None,
}


# Import/Export ---------------------------------------------------------------

EXPORT_BUNDLE = {
    "schemaVersion": seed_content.EXPORT_METADATA["schemaVersion"],
    "generatedAt": "2024-04-12T08:30:00Z",
    "metadata": seed_content.EXPORT_METADATA["metadata"],
    "payload": {
        "villages": [
            {
                **_summary_for_village(
                    village, plant_count=len(_plants_by_village.get(village["id"], ()))
                ),
                "establishedAt": village["established_at"],
            }
            for village in seed_content.VILLAGES
        ],
        "plants": [
            {
                **_plant_payload(plant),
                "villageId": plant["village_id"],
            }
            for plant in seed_content.PLANTS
        ],
    },
}
