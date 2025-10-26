"""Search and tag endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from backend.database import get_session
from backend.schemas.search import SearchResultRead, TagCount
from backend.services import search as search_service

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchResultRead])
def search(q: str = Query(..., min_length=1), session: Session = Depends(get_session)) -> list[SearchResultRead]:
    """Perform a search across plants and logs."""

    results = search_service.search(session, q)
    return [SearchResultRead(**result.__dict__) for result in results]


@router.get("/tags", response_model=list[TagCount])
def list_tags(session: Session = Depends(get_session)) -> list[TagCount]:
    """Return tags with usage counts."""

    search_service.ensure_indexes(session)
    rows = search_service.list_tags(session)
    return [TagCount(tag=tag, count=count) for tag, count in rows]
