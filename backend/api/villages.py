"""API routes for village CRUD operations."""
from __future__ import annotations

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response, status
from sqlmodel import Session

from backend.db import get_session
from backend.models import VillageRead, VillageCreate, VillageUpdate
from backend.repositories.villages import VillageRepository, get_village_or_404

router = APIRouter(prefix="/api/v1/villages", tags=["villages"])

HeaderETag = Annotated[Optional[str], Header(alias="If-None-Match")]


def _normalize_etag(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip('"')


@router.get("/", response_model=List[VillageRead])
def list_villages(
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = VillageRepository(session)
    etag = repository.compute_list_etag()
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    villages = repository.list()
    response.headers["ETag"] = etag
    return [VillageRead.model_validate(village) for village in villages]


@router.post("/", response_model=VillageRead, status_code=status.HTTP_201_CREATED)
def create_village(
    *,
    payload: VillageCreate,
    session: Session = Depends(get_session),
):
    repository = VillageRepository(session)
    village = repository.create(payload)
    return VillageRead.model_validate(village)


@router.get("/{village_id}", response_model=VillageRead)
def get_village(
    village_id: UUID,
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = VillageRepository(session)
    village = get_village_or_404(repository, village_id)
    etag = repository.compute_entity_etag(village)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return VillageRead.model_validate(village)


@router.patch("/{village_id}", response_model=VillageRead)
def update_village(
    village_id: UUID,
    *,
    payload: VillageUpdate,
    session: Session = Depends(get_session),
):
    repository = VillageRepository(session)
    village = get_village_or_404(repository, village_id)
    updated = repository.update(village, payload)
    return VillageRead.model_validate(updated)


@router.delete("/{village_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_village(
    village_id: UUID,
    *,
    session: Session = Depends(get_session),
):
    repository = VillageRepository(session)
    village = get_village_or_404(repository, village_id)
    repository.delete(village)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
