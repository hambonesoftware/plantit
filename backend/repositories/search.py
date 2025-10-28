"""Search repository backed by SQLite FTS5 indices."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import List, Sequence
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session


def _normalize_terms(query: str) -> Sequence[str]:
    tokens = [part.strip() for part in query.split() if part.strip()]
    normalized = []
    for token in tokens:
        safe = token.replace("'", "")
        if not safe:
            continue
        normalized.append(f"{safe}*")
    return normalized


@dataclass(slots=True)
class SearchResult:
    """Represents a single typed search hit."""

    type: str
    id: str
    name: str
    species: str | None
    notes: str | None
    tags: List[str]
    village_id: str | None
    village_name: str | None
    score: float


class SearchRepository:
    """Encapsulates full-text search operations and tag aggregations."""

    def __init__(self, session: Session):
        self.session = session

    def search_plants(self, query: str, limit: int = 20) -> List[SearchResult]:
        terms = _normalize_terms(query)
        if not terms:
            return []
        statement = text(
            """
            SELECT
                plants.id AS plant_id,
                plants.name AS plant_name,
                plants.species AS plant_species,
                plants.notes AS plant_notes,
                plants.tags AS plant_tags,
                plants.village_id AS village_id,
                villages.name AS village_name,
                bm25(plant_search) AS rank
            FROM plant_search
            JOIN plants ON plants.rowid = plant_search.rowid
            LEFT JOIN villages ON villages.id = plants.village_id
            WHERE plant_search MATCH :term
            ORDER BY rank ASC, plants.updated_at DESC
            LIMIT :limit
            """
        )
        term = " ".join(terms)
        results: List[SearchResult] = []
        for row in self.session.exec(
            statement, params={"term": term, "limit": limit}
        ).mappings():
            tags = row["plant_tags"]
            if isinstance(tags, str):
                try:
                    tags = json.loads(tags)
                except json.JSONDecodeError:
                    tags = []
            results.append(
                SearchResult(
                    type="plant",
                    id=_to_uuid_string(row["plant_id"]) or str(row["plant_id"]),
                    name=row["plant_name"],
                    species=row["plant_species"],
                    notes=row["plant_notes"],
                    tags=list(tags or []),
                    village_id=_to_uuid_string(row["village_id"]),
                    village_name=row["village_name"],
                    score=float(row["rank"]),
                )
            )
        return results

    def tag_counts(self) -> List[dict]:
        statement = text(
            """
            SELECT
                LOWER(json_each.value) AS tag_name,
                COUNT(*) AS tag_count
            FROM plants
            JOIN json_each(plants.tags)
            GROUP BY LOWER(json_each.value)
            ORDER BY tag_count DESC, tag_name ASC
            """
        )
        payload = []
        for row in self.session.exec(statement).mappings():
            if row["tag_name"] is None:
                continue
            payload.append({"name": row["tag_name"], "count": int(row["tag_count"])})
        return payload


__all__ = ["SearchRepository", "SearchResult"]
def _to_uuid_string(value: object | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, bytes):
        return str(UUID(bytes=value))
    text = str(value)
    try:
        return str(UUID(text))
    except ValueError:
        try:
            return str(UUID(hex=text.replace("-", "")))
        except ValueError:
            return text
