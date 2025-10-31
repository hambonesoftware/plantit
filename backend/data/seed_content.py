"""Seed data used for initial database population and fixture fallbacks."""
from __future__ import annotations

# Villages -------------------------------------------------------------------

VILLAGES = [
    {
        "id": "village-001",
        "name": "Evergreen Terrace",
        "climate": "Temperate",
        "description": "North-facing terraces with automated drip irrigation and shade cloths.",
        "established_at": "2021-03-15",
        "irrigation_type": "drip",
        "health_score": 0.93,
    },
    {
        "id": "village-002",
        "name": "Solstice Ridge",
        "climate": "Arid",
        "description": "High-elevation beds optimized for drought-resistant varieties.",
        "established_at": "2020-06-09",
        "irrigation_type": "spray",
        "health_score": 0.88,
    },
    {
        "id": "village-003",
        "name": "Cascade Hollow",
        "climate": "Humid",
        "description": "Reclaimed greenhouse space with automated misting and heat recovery.",
        "established_at": "2022-01-20",
        "irrigation_type": "manual",
        "health_score": 0.90,
    },
]

# Plants ---------------------------------------------------------------------

PLANTS = [
    {
        "id": "plant-001",
        "village_id": "village-001",
        "display_name": "Ruby Basil",
        "species": "Ocimum basilicum",
        "stage": "vegetative",
        "last_watered_at": "2024-04-11T07:15:00Z",
        "health_score": 0.96,
        "notes": "Thriving after nutrient boost — monitor color shifts weekly.",
    },
    {
        "id": "plant-002",
        "village_id": "village-001",
        "display_name": "Silver Fern",
        "species": "Pteris cretica",
        "stage": "mature",
        "last_watered_at": "2024-04-11T08:45:00Z",
        "health_score": 0.91,
        "notes": "Fronds still delicate — maintain indirect light exposure.",
    },
    {
        "id": "plant-003",
        "village_id": "village-002",
        "display_name": "Sunburst Succulent",
        "species": "Sedum nussbaumerianum",
        "stage": "flowering",
        "last_watered_at": "2024-04-10T14:10:00Z",
        "health_score": 0.87,
        "notes": "Color saturating nicely. Rotate weekly for even growth.",
    },
    {
        "id": "plant-004",
        "village_id": "village-002",
        "display_name": "Amber Aloe",
        "species": "Aloe vera",
        "stage": "vegetative",
        "last_watered_at": "2024-04-09T12:00:00Z",
        "health_score": 0.79,
        "notes": "Drip system clog detected. Flush emitter before next cycle.",
    },
    {
        "id": "plant-005",
        "village_id": "village-003",
        "display_name": "Moonlit Kale",
        "species": "Brassica oleracea",
        "stage": "mature",
        "last_watered_at": "2024-04-11T09:30:00Z",
        "health_score": 0.84,
        "notes": "Powdery mildew spotted on outer leaves — treat with sulfur spray.",
    },
    {
        "id": "plant-006",
        "village_id": "village-003",
        "display_name": "Cascade Mint",
        "species": "Mentha canadensis",
        "stage": "vegetative",
        "last_watered_at": "2024-04-11T05:40:00Z",
        "health_score": 0.92,
        "notes": "Aromatic profile strong. Harvest tips weekly to encourage growth.",
    },
    {
        "id": "plant-007",
        "village_id": "village-003",
        "display_name": "Twilight Orchid",
        "species": "Cattleya trianae",
        "stage": "flowering",
        "last_watered_at": "2024-04-10T18:05:00Z",
        "health_score": 0.76,
        "notes": "Humidity spike required nightly — ensure fogger schedule updated.",
    },
]

# Timeline -------------------------------------------------------------------

PLANT_TIMELINE = {
    "plant-001": [
        {
            "id": "event-001",
            "occurredAt": "2024-04-10T07:00:00Z",
            "type": "watering",
            "summary": "Automated drip cycle completed (450ml).",
        },
        {
            "id": "event-002",
            "occurredAt": "2024-04-08T09:15:00Z",
            "type": "note",
            "summary": "Leaf coloration deepening; monitor for bolting.",
        },
    ],
    "plant-004": [
        {
            "id": "event-003",
            "occurredAt": "2024-04-11T06:45:00Z",
            "type": "inspection",
            "summary": "Emitter clogged; scheduled manual flush.",
        }
    ],
    "plant-007": [
        {
            "id": "event-004",
            "occurredAt": "2024-04-11T12:20:00Z",
            "type": "inspection",
            "summary": "Powdery mildew detected on two petals.",
        },
        {
            "id": "event-005",
            "occurredAt": "2024-04-09T17:00:00Z",
            "type": "watering",
            "summary": "Misting schedule increased to 15-minute intervals overnight.",
        },
    ],
}

# Tasks ----------------------------------------------------------------------

TODAY_TASKS = [
    {
        "id": "task-001",
        "type": "water",
        "plant_id": "plant-004",
        "plant_name": "Amber Aloe",
        "village_name": "Solstice Ridge",
        "due_at": "2024-04-12T10:00:00Z",
        "priority": "high",
    },
    {
        "id": "task-002",
        "type": "inspect",
        "plant_id": "plant-007",
        "plant_name": "Twilight Orchid",
        "village_name": "Cascade Hollow",
        "due_at": "2024-04-12T12:30:00Z",
        "priority": "high",
    },
    {
        "id": "task-003",
        "type": "fertilize",
        "plant_id": "plant-002",
        "plant_name": "Silver Fern",
        "village_name": "Evergreen Terrace",
        "due_at": "2024-04-12T15:00:00Z",
        "priority": "medium",
    },
]

# Dashboard ------------------------------------------------------------------

DASHBOARD_ALERTS = [
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
]

# Export metadata -------------------------------------------------------------

EXPORT_METADATA = {
    "schemaVersion": 1,
    "metadata": {
        "source": "seed",
        "note": "Generated from seed data.",
    },
}
