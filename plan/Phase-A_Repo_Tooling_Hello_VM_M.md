# Phase A — Repo, Tooling & Hello VM/M
## Objective
Clean repo scaffold with FastAPI health endpoint and frontend shell.

## Prerequisites
- Python 3.12 and Node 20+ installed.

## Detailed Work Items
1. Create repo structure, Makefile, lint/format/test, pre-commit.
2. FastAPI app with GET /api/v1/health returning {"ok": true}.
3. Frontend index.html + minimal script; static dev server.
4. README with dev instructions; reference plan and agents.

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

```
frontend/
  index.html
  styles/{tokens.css, base.css}
  js/
    router.js
    services/apiClient.js
    thinvms/{HomeThinVM.js, VillagesThinVM.js, VillageDetailThinVM.js, PlantDetailThinVM.js}
    views/{home-view.js, villages-view.js, village-detail-view.js, plant-detail-view.js}
```

## API/UI Contracts
- CRUD namespace reserved at `/api/v1/*`; VM namespace reserved at `/api/v1/vm/*`.
- `GET /api/v1/health` → `{ "ok": true }`.

## Tests
- Health endpoint test (200, JSON shape).
- Lint passes (ruff/black, eslint).

## Manual QA
- Run app; verify health endpoint JSON.
- Open index.html; verify shell loads.

## Risks & Mitigations
- Scope creep or broken dev loop.
- Fix by reverting to minimal files and tests.

## Rollback
Remove new files; no DB involved.

## Definition of Done
- Health endpoint works
- Dev loop works
- Repo matches documented structure
