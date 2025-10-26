# Phase 03 — Search (FTS5) & Tag Index
## Objective
Provide global search across plants and logs; expose tag counts.

## Prerequisites
- Phases 00–02 complete.

## Detailed Work Items
1. Create SQLite FTS5 tables for Plant text and Log text.
2. Implement triggers to maintain FTS indexes on insert/update/delete.
3. Build `GET /api/v1/search?q=` returning typed results with snippets.
4. Build `GET /api/v1/tags` returning tag counts.

## File Tree Changes
```
backend/services/search.py
backend/api/search.py
backend/tests/test_search.py
```

## API Contract
- `GET /api/v1/search?q=...` → list of objects with `type`, `id`, `title`, `snippet`.
- `GET /api/v1/tags` → list of { "tag": "...", "count": n }.

## Tests
- Ranking and index maintenance tests.

## Manual QA
- Seed data; run queries and verify expected top hits.

## Definition of Done
- Search and tags endpoints fast and correct.
