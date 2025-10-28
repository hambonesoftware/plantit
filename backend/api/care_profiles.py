"""API routes for plant care profiles."""
from __future__ import annotations

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlmodel import Session

from backend.db import get_session
from backend.models import CareProfileCreate, CareProfileRead, CareProfileUpdate
from backend.repositories.care_profiles import CareProfileRepository
from backend.utils.etag import compute_etag

router = APIRouter(prefix="/api/v1/care-profiles", tags=["care_profiles"])

HeaderETag = Annotated[Optional[str], Header(alias="If-None-Match")]


def _normalize_etag(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip('"')


@router.get("/", response_model=List[CareProfileRead])
def list_care_profiles(
    *,
    session: Session = Depends(get_session),
    plant_id: Optional[UUID] = Query(default=None),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = CareProfileRepository(session)
    profiles = repository.list(plant_id=plant_id)
    payload = [CareProfileRead.model_validate(profile) for profile in profiles]
    etag = compute_etag([item.model_dump() for item in payload])
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.post("/", response_model=CareProfileRead, status_code=status.HTTP_201_CREATED)
def create_care_profile(
    *,
    payload: CareProfileCreate,
    session: Session = Depends(get_session),
):
    repository = CareProfileRepository(session)
    profile = repository.create(payload)
    return CareProfileRead.model_validate(profile)


@router.get("/{profile_id}", response_model=CareProfileRead)
def get_care_profile(
    profile_id: UUID,
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = CareProfileRepository(session)
    profile = repository.get(profile_id)
    payload = CareProfileRead.model_validate(profile)
    etag = compute_etag(payload.model_dump())
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.patch("/{profile_id}", response_model=CareProfileRead)
def update_care_profile(
    profile_id: UUID,
    *,
    payload: CareProfileUpdate,
    session: Session = Depends(get_session),
):
    repository = CareProfileRepository(session)
    profile = repository.get(profile_id)
    updated = repository.update(profile, payload)
    return CareProfileRead.model_validate(updated)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_care_profile(
    profile_id: UUID,
    *,
    session: Session = Depends(get_session),
):
    repository = CareProfileRepository(session)
    profile = repository.get(profile_id)
    repository.delete(profile)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
