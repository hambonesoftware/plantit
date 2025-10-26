# Phase 01 — Data Model & CRUD
## Objective
Implement persistent storage and CRUD endpoints for Villages, Plants, Tasks, Logs, Photos metadata, and Settings.

## Prerequisites
- Phase 00 complete.

## Detailed Work Items
1. Add SQLModel entities and migrations initializer.
2. Implement Pydantic schemas with enums for kinds.
3. Implement repositories and routers for CRUD operations.
4. Seed script for demo data.
5. OpenAPI tags and examples for each route.

## File Tree Changes
```
backend/models/
  __init__.py
  village.py
  plant.py
  task.py
  log.py
  photo.py
  settings.py
```

```
backend/api/
  villages.py
  plants.py
  tasks.py
  logs.py
  photos.py
  settings.py
```

```
backend/schemas/
  __init__.py
  village.py
  plant.py
  task.py
  log.py
  photo.py
  settings.py
backend/repositories/
  __init__.py
  villages.py
  plants.py
  tasks.py
  logs.py
  photos.py
  settings.py
backend/services/
  __init__.py
  timeutils.py
backend/tests/
  test_villages.py
  test_plants.py
  test_tasks.py
  test_logs.py
  test_settings.py
scripts/seed.py
```

## API Contract (new/updated)
- Villages: `GET/POST/GET{id}/PATCH/DELETE`
- Plants: `GET (village_id,q,tag)/POST/GET{id}/PATCH/DELETE` and `POST /api/v1/plants/{id}:move`
- Tasks: `GET (state/date)/POST/PATCH{id}`
- Logs: `GET /api/v1/plants/{id}/logs`, `POST /api/v1/plants/{id}/logs`
- Settings: `GET/PUT`

## Tests
- Round-trip CRUD tests; constraint tests (FKs, enums); seed idempotency.

## Manual QA
- Seed DB; use curl to create/edit/delete resources; verify counts.

## Risks & Mitigations
- Schema drift: Keep schemas and models in sync with shared enums.

## Rollback
- Drop DB file `./backend/data/plantit.db` and re-run migrations.

## Definition of Done
- All CRUD endpoints pass tests; OpenAPI accurate; seed script works.
