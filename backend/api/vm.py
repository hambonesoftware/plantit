"""API routes serving backend view models."""
from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response, status
from sqlmodel import Session

from backend.db import get_session
from backend.utils.etag import compute_etag
from backend.viewmodels import (
    build_home_vm,
    build_plant_vm,
    build_village_vm,
    build_villages_vm,
)

router = APIRouter(prefix="/api/v1/vm", tags=["viewmodels"])

HeaderETag = Annotated[Optional[str], Header(alias="If-None-Match")]


def _normalize_etag(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip('"')


@router.get("/home")
def home_vm(
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    payload = build_home_vm(session)
    etag = compute_etag(payload)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.get("/villages")
def villages_vm(
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    payload = build_villages_vm(session)
    etag = compute_etag(payload)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.get("/village/{village_id}")
def village_vm(
    village_id: UUID,
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    payload = build_village_vm(session, village_id)
    etag = compute_etag(payload)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.get("/plant/{plant_id}")
def plant_vm(
    plant_id: UUID,
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    payload = build_plant_vm(session, plant_id)
    etag = compute_etag(payload)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload
