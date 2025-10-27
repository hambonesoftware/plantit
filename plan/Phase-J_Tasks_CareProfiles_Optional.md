# Phase J — Tasks & Care Profiles (Optional)
## Objective
Introduce scheduling if needed (every N days / weekly).

## Prerequisites
- Phases B–I complete.

## Detailed Work Items
1. Add `Task` and `CareProfile` models and CRUD.
2. Cadence service computes next-due and generates tasks deterministically.
3. Extend VMs: Home Today list; Plant next-due.

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
- Extend VM shapes minimally to expose Today list and next-due values.

## Tests
- Cadence boundary tests (month-end, leap year).
- UI actions update VM on complete/reschedule.

## Manual QA
- Complete and reschedule tasks; verify VM refresh and correctness.

## Risks & Mitigations
- Duplicate generation; make cadence idempotent with guards.

## Rollback
Remove generated tasks and rollback schema migration.

## Definition of Done
- Deterministic scheduling
- UI updates immediately
- No duplicates
