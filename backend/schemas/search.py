"""Schemas for search endpoints."""

from pydantic import BaseModel


class SearchResultRead(BaseModel):
    type: str
    id: int
    title: str
    snippet: str


class TagCount(BaseModel):
    tag: str
    count: int
