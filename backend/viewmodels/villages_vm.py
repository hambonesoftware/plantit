"""Villages list view model construction."""
from __future__ import annotations

from sqlmodel import Session, select

from backend.models import Village


def build_villages_vm(session: Session) -> dict:
    """Return the villages collection for the frontend shell."""
    villages = session.exec(select(Village).order_by(Village.name)).all()
    return {
        "villages": [
            {
                "id": str(village.id),
                "name": village.name,
                "location": village.location,
                "description": village.description,
                "created_at": village.created_at.isoformat(),
                "updated_at": village.updated_at.isoformat(),
            }
            for village in villages
        ]
    }
