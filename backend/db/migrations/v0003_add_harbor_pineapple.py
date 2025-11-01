"""Add the Harbor Pineapple plant to Evergreen Terrace when missing."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.engine import Connection


VERSION = "0003_add_harbor_pineapple"

_PLANT_ID = "plant-008"
_VILLAGE_ID = "village-001"


def _plant_exists(connection: Connection) -> bool:
    result = connection.execute(
        text("SELECT 1 FROM plants WHERE id = :plant_id"), {"plant_id": _PLANT_ID}
    ).first()
    return result is not None


def _village_exists(connection: Connection) -> bool:
    result = connection.execute(
        text("SELECT 1 FROM villages WHERE id = :village_id"), {"village_id": _VILLAGE_ID}
    ).first()
    return result is not None


def apply(connection: Connection) -> None:
    """Insert the missing plant while keeping the migration idempotent."""

    if _plant_exists(connection):
        return
    if not _village_exists(connection):
        return

    last_watered = datetime(2024, 4, 11, 16, 20, tzinfo=timezone.utc)

    connection.execute(
        text(
            """
            INSERT INTO plants (
                id,
                village_id,
                display_name,
                species,
                stage,
                last_watered_at,
                health_score,
                notes
            ) VALUES (
                :plant_id,
                :village_id,
                :display_name,
                :species,
                :stage,
                :last_watered_at,
                :health_score,
                :notes
            )
            """
        ),
        {
            "plant_id": _PLANT_ID,
            "village_id": _VILLAGE_ID,
            "display_name": "Harbor Pineapple",
            "species": "Ananas comosus",
            "stage": "vegetative",
            "last_watered_at": last_watered,
            "health_score": 0.82,
            "notes": "Stabilized after transplant — monitor crown for new growth.",
        },
    )

    connection.execute(
        text("UPDATE villages SET updated_at = CURRENT_TIMESTAMP WHERE id = :village_id"),
        {"village_id": _VILLAGE_ID},
    )
