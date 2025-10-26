"""Village management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from backend.database import get_session
from backend.schemas.village import VillageCreate, VillageRead
from backend.services.villages import create_village, list_villages

router = APIRouter(prefix="/villages", tags=["villages"])


@router.get("", response_model=dict[str, list[VillageRead]])
def get_villages(session: Session = Depends(get_session)) -> dict[str, list[VillageRead]]:
    """Return all villages."""

    villages = list_villages(session)
    return {"items": villages}


@router.post("", response_model=VillageRead, status_code=status.HTTP_201_CREATED)
def post_village(payload: VillageCreate, session: Session = Depends(get_session)) -> VillageRead:
    """Create a new village."""

    return create_village(session, payload)
