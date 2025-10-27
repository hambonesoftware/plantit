# Phase B — Models & CRUD (Villages/Plants)
## Objective
Persist Villages and Plants with complete CRUD and ETags.

## Prerequisites
- Phase A complete.

## Detailed Work Items
1. Define SQLModel `Village` and `Plant` (UUID primary keys, created_at, updated_at).
2. Create repositories and routers for fully tested CRUD.
3. Implement ETag generation for list/detail.
4. Add a seed script with sample villages/plants.

## File Tree Changes
```
backend/
  app.py
  db.py
  models/{__init__.py, village.py, plant.py}
  repositories/{__init__.py, villages.py, plants.py}
  services/{__init__.py, aggregations.py}
  viewmodels/{__init__.py, home_vm.py, villages_vm.py, village_vm.py, plant_vm.py}
  api/{__init__.py, health.py, villages.py, plants.py, vm.py}
  tests/{test_crud_villages.py, test_crud_plants.py, test_vm_home.py, test_vm_village.py, test_vm_plant.py}
  data/ (runtime)
```

## API/UI Contracts
- Villages CRUD: `GET/POST/GET{id}/PATCH/DELETE` under `/api/v1/villages`.
- Plants CRUD: `GET (village_id,q,tag)/POST/GET{id}/PATCH/DELETE` under `/api/v1/plants`.
- All GETs include `ETag` header; responses include stable UUID `id` fields.

## Tests
- CRUD round-trip tests for villages and plants.
- FK integrity tests.
- ETag presence tests.

## Manual QA
- Use curl/Postman to exercise CRUD; confirm DB changes persist across restarts.

## Risks & Mitigations
- Schema drift; mitigate with Pydantic schemas and tests.

## Rollback
Drop DB file and rerun seed to restore to known state.

## Definition of Done
- All CRUD endpoints pass tests
- ETags present
- DB persists across runs
