# Phase L — Export / Import
## Objective
Backup and restore JSON bundles with media manifest.

## Prerequisites
- Phases B–K complete.

## Detailed Work Items
1. Add `GET /api/v1/export?scope=all|village|plant` returning JSON bundle + media manifest.
2. Add `POST /api/v1/import` that upserts and reports conflicts.
3. UI hooks to trigger export/import.

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
- Export schema stable and documented; import is idempotent and safe.

## Tests
- Round-trip tests on clean DB and on conflicting IDs.

## Manual QA
- Export → wipe DB → Import → verify full parity including photos.

## Risks & Mitigations
- ID collisions; use ID remap and natural keys where needed.

## Rollback
Restore DB from previous export file kept locally.

## Definition of Done
- Reliable export/import
- No data loss
- Photos remapped correctly
