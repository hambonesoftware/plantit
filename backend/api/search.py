"""API routes for global search and tag aggregations."""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from sqlmodel import Session

from backend.db import get_session
from backend.repositories.search import SearchRepository
from backend.utils.etag import compute_etag

router = APIRouter(prefix="/api/v1", tags=["search"])

HeaderETag = Annotated[Optional[str], Header(alias="If-None-Match")]


def _normalize_etag(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    return value.strip('"')


@router.get("/search")
def search(
    *,
    q: str = Query(..., min_length=1, max_length=200, alias="q"),
    limit: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    query = q.strip()
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Query cannot be blank.",
                    "field": "q",
                }
            },
        )
    repository = SearchRepository(session)
    results = [
        {
            "type": item.type,
            "id": item.id,
            "name": item.name,
            "species": item.species,
            "notes": item.notes,
            "tags": item.tags,
            "village": {
                "id": item.village_id,
                "name": item.village_name,
            },
            "score": item.score,
        }
        for item in repository.search_plants(query, limit=limit)
    ]
    payload = {"query": query, "results": results}
    etag = compute_etag(payload)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


@router.get("/tags")
def list_tags(
    *,
    session: Session = Depends(get_session),
    if_none_match: HeaderETag = None,
    response: Response,
):
    repository = SearchRepository(session)
    payload = {"tags": repository.tag_counts()}
    etag = compute_etag(payload)
    if _normalize_etag(if_none_match) == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED)
    response.headers["ETag"] = etag
    return payload


__all__ = ["router"]
