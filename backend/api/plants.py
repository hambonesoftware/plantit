"""API routes for plant CRUD operations."""
from __future__ import annotations

from typing import Annotated, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlmodel import Session

from backend.db import get_session
from backend.models import PlantCreate, PlantRead, PlantUpdate
from backend.repositories.plants import PlantRepository

router = APIRouter(prefix="/api/v1/plants", tags=["plants"])

HeaderETag = Annotated[Optional[str], Header(alias="If-None-Match")]


def _normalize_etag(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip('"')


@router.get("/", response_model=List[PlantRead])
def list_plants(
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    village_id: Optional[UUID] = Query(default=None),
    q: Optional[str] = Query(default=None, max_length=200),
    tag: Optional[str] = Query(default=None, max_length=50),
    response: Response,
):
    repository = PlantRepository(session)
    etag = repository.compute_list_etag(village_id=village_id, query=q, tag=tag)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    plants = repository.list(village_id=village_id, query=q, tag=tag)
    response.headers["ETag"] = etag
    return [PlantRead.model_validate(plant) for plant in plants]


@router.post("/", response_model=PlantRead, status_code=status.HTTP_201_CREATED)
def create_plant(
    *,
    payload: PlantCreate,
    session: Session = Depends(get_session),
):
    repository = PlantRepository(session)
    plant = repository.create(payload)
    return PlantRead.model_validate(plant)


@router.get("/{plant_id}", response_model=PlantRead)
def get_plant(
    plant_id: UUID,
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = PlantRepository(session)
    plant = repository.get(plant_id)
    etag = repository.compute_entity_etag(plant)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return PlantRead.model_validate(plant)


@router.patch("/{plant_id}", response_model=PlantRead)
def update_plant(
    plant_id: UUID,
    *,
    payload: PlantUpdate,
    session: Session = Depends(get_session),
):
    repository = PlantRepository(session)
    plant = repository.get(plant_id)
    updated = repository.update(plant, payload)
    return PlantRead.model_validate(updated)


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plant(
    plant_id: UUID,
    *,
    session: Session = Depends(get_session),
):
    repository = PlantRepository(session)
    plant = repository.get(plant_id)
    repository.delete(plant)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
