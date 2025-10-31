"""Static fixtures used by early API phases.

The fixtures provide deterministic payloads for the read-path endpoints until
real persistence layers are wired up in later phases.  Keeping the data in a
single module allows contract tests to reference the same shapes that the
OpenAPI specification documents.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Sequence

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


@dataclass(frozen=True)
class _VillageSummary:
    id: str
    name: str
    climate: str
    plantCount: int
    healthScore: float


# Dashboard -----------------------------------------------------------------

DASHBOARD_PAYLOAD = {
    "summary": {
        "totalPlants": 42,
        "activeVillages": 3,
        "successRate": 0.94,
        "upcomingTasks": 6,
    },
    "alerts": [
        {
            "id": "alert-failing-drip",
            "level": "warning",
            "message": "Drip irrigation flow is below threshold in Evergreen Terrace.",
            "relatedPlantId": "plant-004",
        },
        {
            "id": "alert-powdery-mildew",
            "level": "critical",
            "message": "Powdery mildew detected on Moonlit Kale — inspect immediately.",
            "relatedPlantId": "plant-007",
        },
    ],
    "lastUpdated": "2024-04-12T08:30:00Z",
}


# Villages -------------------------------------------------------------------

VILLAGE_SUMMARIES: Sequence[Dict[str, object]] = [
    {
        "id": "village-001",
        "name": "Evergreen Terrace",
        "climate": "Temperate",
        "plantCount": 18,
        "healthScore": 0.93,
    },
    {
        "id": "village-002",
        "name": "Solstice Ridge",
        "climate": "Arid",
        "plantCount": 11,
        "healthScore": 0.88,
    },
    {
        "id": "village-003",
        "name": "Cascade Hollow",
        "climate": "Humid",
        "plantCount": 13,
        "healthScore": 0.9,
    },
]

VILLAGE_DETAIL_BY_ID: Dict[str, Dict[str, object]] = {
    summary["id"]: {
        **summary,
        "description": description,
        "establishedAt": established,
        "irrigationType": irrigation,
    }
    for summary, description, established, irrigation in [
        (
            _VillageSummary("village-001", "Evergreen Terrace", "Temperate", 18, 0.93).__dict__,
            "North-facing terraces with automated drip irrigation and shade cloths.",
            "2021-03-15",
            "drip",
        ),
        (
            _VillageSummary("village-002", "Solstice Ridge", "Arid", 11, 0.88).__dict__,
            "High-elevation beds optimized for drought-resistant varieties.",
            "2020-06-09",
            "spray",
        ),
        (
            _VillageSummary("village-003", "Cascade Hollow", "Humid", 13, 0.90).__dict__,
            "Reclaimed greenhouse space with automated misting and heat recovery.",
            "2022-01-20",
            "manual",
        ),
    ]
}

VILLAGE_PLANTS_BY_ID: Dict[str, List[Dict[str, object]]] = {
    "village-001": [
        {
            "id": "plant-001",
            "displayName": "Ruby Basil",
            "species": "Ocimum basilicum",
            "stage": "vegetative",
            "lastWateredAt": "2024-04-11T07:15:00Z",
            "healthScore": 0.96,
        },
        {
            "id": "plant-002",
            "displayName": "Silver Fern",
            "species": "Pteris cretica",
            "stage": "mature",
            "lastWateredAt": "2024-04-11T08:45:00Z",
            "healthScore": 0.91,
        },
    ],
    "village-002": [
        {
            "id": "plant-003",
            "displayName": "Sunburst Succulent",
            "species": "Sedum nussbaumerianum",
            "stage": "flowering",
            "lastWateredAt": "2024-04-10T14:10:00Z",
            "healthScore": 0.87,
        },
        {
            "id": "plant-004",
            "displayName": "Amber Aloe",
            "species": "Aloe vera",
            "stage": "vegetative",
            "lastWateredAt": "2024-04-09T12:00:00Z",
            "healthScore": 0.79,
        },
    ],
    "village-003": [
        {
            "id": "plant-005",
            "displayName": "Moonlit Kale",
            "species": "Brassica oleracea",
            "stage": "mature",
            "lastWateredAt": "2024-04-11T09:30:00Z",
            "healthScore": 0.84,
        },
        {
            "id": "plant-006",
            "displayName": "Cascade Mint",
            "species": "Mentha canadensis",
            "stage": "vegetative",
            "lastWateredAt": "2024-04-11T05:40:00Z",
            "healthScore": 0.92,
        },
        {
            "id": "plant-007",
            "displayName": "Twilight Orchid",
            "species": "Cattleya trianae",
            "stage": "flowering",
            "lastWateredAt": "2024-04-10T18:05:00Z",
            "healthScore": 0.76,
        },
    ],
}


# Plant detail ---------------------------------------------------------------

PLANT_DETAIL_BY_ID: Dict[str, Dict[str, object]] = {
    "plant-001": {
        "id": "plant-001",
        "displayName": "Ruby Basil",
        "species": "Ocimum basilicum",
        "villageName": "Evergreen Terrace",
        "lastWateredAt": "2024-04-11T07:15:00Z",
        "healthScore": 0.96,
        "notes": "Thriving after nutrient boost — monitor color shifts weekly.",
    },
    "plant-002": {
        "id": "plant-002",
        "displayName": "Silver Fern",
        "species": "Pteris cretica",
        "villageName": "Evergreen Terrace",
        "lastWateredAt": "2024-04-11T08:45:00Z",
        "healthScore": 0.91,
        "notes": "Rotate tray during next maintenance cycle to balance canopy.",
    },
    "plant-003": {
        "id": "plant-003",
        "displayName": "Sunburst Succulent",
        "species": "Sedum nussbaumerianum",
        "villageName": "Solstice Ridge",
        "lastWateredAt": "2024-04-10T14:10:00Z",
        "healthScore": 0.87,
        "notes": "Supplemental lighting reduced scorch spots — keep monitoring.",
    },
    "plant-004": {
        "id": "plant-004",
        "displayName": "Amber Aloe",
        "species": "Aloe vera",
        "villageName": "Solstice Ridge",
        "lastWateredAt": "2024-04-09T12:00:00Z",
        "healthScore": 0.79,
        "notes": "Irrigation flow low — inspect emitter during weekly rounds.",
    },
    "plant-005": {
        "id": "plant-005",
        "displayName": "Moonlit Kale",
        "species": "Brassica oleracea",
        "villageName": "Cascade Hollow",
        "lastWateredAt": "2024-04-11T09:30:00Z",
        "healthScore": 0.84,
        "notes": "Fungal pressure rising; preventative spray scheduled.",
    },
    "plant-006": {
        "id": "plant-006",
        "displayName": "Cascade Mint",
        "species": "Mentha canadensis",
        "villageName": "Cascade Hollow",
        "lastWateredAt": "2024-04-11T05:40:00Z",
        "healthScore": 0.92,
        "notes": "Harvest scheduled for upcoming tasting event.",
    },
    "plant-007": {
        "id": "plant-007",
        "displayName": "Twilight Orchid",
        "species": "Cattleya trianae",
        "villageName": "Cascade Hollow",
        "lastWateredAt": "2024-04-10T18:05:00Z",
        "healthScore": 0.76,
        "notes": "Mildew detected — maintain isolation bench until cleared.",
    },
}

PLANT_TIMELINE_BY_ID: Dict[str, List[Dict[str, object]]] = {
    "plant-001": [
        {
            "id": "event-plant-001-01",
            "occurredAt": "2024-04-10T06:00:00Z",
            "type": "watering",
            "summary": "Automated irrigation cycle completed (2.5L).",
        },
        {
            "id": "event-plant-001-02",
            "occurredAt": "2024-04-08T12:40:00Z",
            "type": "fertilizer",
            "summary": "Applied foliar feed — 15-5-10 at 1:200 dilution.",
        },
    ],
    "plant-005": [
        {
            "id": "event-plant-005-01",
            "occurredAt": "2024-04-09T09:15:00Z",
            "type": "inspection",
            "summary": "Leaf spot noted on lower canopy leaves.",
        },
        {
            "id": "event-plant-005-02",
            "occurredAt": "2024-04-07T07:20:00Z",
            "type": "note",
            "summary": "Improved growth after humidity adjustments.",
        },
    ],
    "plant-007": [
        {
            "id": "event-plant-007-01",
            "occurredAt": "2024-04-10T18:05:00Z",
            "type": "inspection",
            "summary": "Powdery mildew detected on two leaves.",
        },
        {
            "id": "event-plant-007-02",
            "occurredAt": "2024-04-08T16:30:00Z",
            "type": "watering",
            "summary": "Hand-watered due to emitter clog during automated cycle.",
        },
    ],
}


# Today tasks ----------------------------------------------------------------

TODAY_TASKS_RESPONSE = {
    "tasks": [
        {
            "id": "task-001",
            "type": "water",
            "plantId": "plant-004",
            "plantName": "Amber Aloe",
            "villageName": "Solstice Ridge",
            "dueAt": "2024-04-12T10:00:00Z",
            "priority": "high",
        },
        {
            "id": "task-002",
            "type": "inspect",
            "plantId": "plant-007",
            "plantName": "Twilight Orchid",
            "villageName": "Cascade Hollow",
            "dueAt": "2024-04-12T12:30:00Z",
            "priority": "high",
        },
        {
            "id": "task-003",
            "type": "fertilize",
            "plantId": "plant-002",
            "plantName": "Silver Fern",
            "villageName": "Evergreen Terrace",
            "dueAt": "2024-04-12T15:00:00Z",
            "priority": "medium",
        },
    ],
    "emptyStateMessage": None,
}


# Import/Export ---------------------------------------------------------------

HELLO_PAYLOAD = {"message": "Hello, Plantit"}

HEALTH_PAYLOAD = {"status": "ok", "checks": {"db": "ok"}}

EXPORT_BUNDLE = {
    "schemaVersion": 1,
    "generatedAt": "2024-04-12T08:30:00Z",
    "metadata": {
        "source": "fixture",
        "note": "Static export bundle for contract tests.",
    },
    "payload": {
        "villages": [
            {
                "id": detail["id"],
                "name": detail["name"],
                "climate": detail["climate"],
                "plantCount": detail["plantCount"],
                "healthScore": detail["healthScore"],
                "establishedAt": detail["establishedAt"],
            }
            for detail in VILLAGE_DETAIL_BY_ID.values()
        ],
        "plants": [
            {
                "id": plant["id"],
                "displayName": plant["displayName"],
                "species": plant["species"],
                "villageId": next(
                    village_id
                    for village_id, plants in VILLAGE_PLANTS_BY_ID.items()
                    if any(item["id"] == plant["id"] for item in plants)
                ),
                "lastWateredAt": plant["lastWateredAt"],
                "healthScore": plant["healthScore"],
            }
            for plant in PLANT_DETAIL_BY_ID.values()
        ],
    },
}
