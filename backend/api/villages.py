"""Village management endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session

from backend.database import get_session
from backend.schemas.village import VillageCreate, VillageRead, VillageUpdate
from backend.services.villages import (
    create_village,
    delete_village as delete_village_service,
    list_villages,
    read_village,
    update_village as update_village_service,
)

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


@router.get("/{village_id}", response_model=VillageRead)
def get_village_detail(village_id: int, session: Session = Depends(get_session)) -> VillageRead:
    """Return a single village."""

    village = read_village(session, village_id)
    if village is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Village not found.")
    return village


@router.patch("/{village_id}", response_model=VillageRead)
def patch_village(
    village_id: int,
    payload: VillageUpdate,
    session: Session = Depends(get_session),
) -> VillageRead:
    """Partially update a village."""

    updated = update_village_service(session, village_id, payload)
    if updated is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Village not found.")
    return updated


@router.delete("/{village_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_village(village_id: int, session: Session = Depends(get_session)) -> Response:
    """Delete a village."""

    deleted = delete_village_service(session, village_id)
    if not deleted:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Village not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
