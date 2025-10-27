# Phase N — Packaging & Deployment
## Objective
Serve the frontend from FastAPI and containerize the app.

## Prerequisites
- All prior phases that affect runtime paths are complete.

## Detailed Work Items
1. Mount `frontend/` statics in FastAPI; index at `/`.
2. Create Dockerfile (multi-stage) and optional docker-compose.
3. Add container healthcheck and smoke tests.

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
- No contract changes; runtime serves both API and statics.

## Tests
- Container start/stop tests; curl health and one VM endpoint.

## Manual QA
- Run container locally and navigate app end-to-end.

## Risks & Mitigations
- Static path misconfig; ensure correct mount and SPA fallback if needed.

## Rollback
Fallback to separate static server while fixing mount config.

## Definition of Done
- Single container boots
- Healthcheck green
- UI+API served together
