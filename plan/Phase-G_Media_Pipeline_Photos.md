# Phase G — Media Pipeline (Photos)
## Objective
Upload/delete photos for plants; extend VMs with photo metadata.

## Prerequisites
- Phases B–F complete.

## Detailed Work Items
1. Add `POST /api/v1/plants/{id}/photos` (multipart) with validation and EXIF orientation.
2. Store originals and generate `thumb_{uuid}.jpg`.
3. Extend `vm/village` plant items with `has_photo` and `thumb_url`; extend `vm/plant` with `photos[]`.
4. Add `DELETE /api/v1/photos/{id}` to clean up files and DB rows.

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
- Upload and delete endpoints for photos; VM shapes include photo info and URLs under `/media/*`.

## Tests
- Upload/delete tests including EXIF and path traversal safety.

## Manual QA
- Upload a few JPEGs and verify thumbs; refresh VM to show new images.

## Risks & Mitigations
- Large files or corrupted EXIF; set size/type limits, safe EXIF extraction.

## Rollback
Delete newly created photo rows and files; leave plant/village untouched.

## Definition of Done
- Photos upload and render
- Thumbnails generated
- VMs surface photo info
