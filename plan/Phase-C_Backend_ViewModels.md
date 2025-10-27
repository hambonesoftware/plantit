# Phase C — Backend ViewModels
## Objective
Expose view-ready JSON at `/api/v1/vm/*` for home, villages, village detail, and plant detail.

## Prerequisites
- Phase B complete.

## Detailed Work Items
1. Implement `home_vm`, `villages_vm`, `village_vm`, `plant_vm` modules.
2. Add `/api/v1/vm/home`, `/api/v1/vm/villages`, `/api/v1/vm/village/{id}`, `/api/v1/vm/plant/{id}` routes.
3. Compute counts in services; return ETags on GETs.
4. Document OpenAPI examples for each VM.

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
**ViewModel endpoints:**

- `GET /api/v1/vm/home` shape:
```
{ 
  "title": "Villages",
  "villages": [
    { "id": "c7b6", "name": "Sunroom", "plant_count": 5, "last_updated": "2025-10-24T14:12:01Z" }
  ]
}
```

- `GET /api/v1/vm/villages` shape:
```
{ 
  "villages": [
    { "id": "c7b6", "name": "Sunroom", "description": "", "plant_count": 5 },
    { "id": "a2b1", "name": "Patio", "description": "Outdoor", "plant_count": 7 }
  ]
}
```

- `GET /api/v1/vm/village/{id}` shape:
```
{ 
  "village": { "id": "c7b6", "name": "Sunroom", "description": "" },
  "plants": [
    { "id": "p001", "display_name": "Monstera", "species_common": "Swiss cheese plant",
      "species_latin": "Monstera deliciosa", "tags": ["tropical"] }
  ],
  "counts": { "total": 5 }
}
```

- `GET /api/v1/vm/plant/{id}` shape:
```
{ 
  "plant": {
    "id": "p001", "village_id": "c7b6",
    "display_name": "Monstera", "species_common": "Swiss cheese plant", "species_latin": "Monstera deliciosa",
    "acquired_on": "2024-06-12", "notes": "", "tags": ["tropical"]
  },
  "village": { "id": "c7b6", "name": "Sunroom" }
}
```

Rules: server computes counts; no UI-specific formatting beyond strings and numbers.

## Tests
- Unit tests asserting exact VM JSON shapes and counts.
- ETag on VM GET responses.

## Manual QA
- GET each VM endpoint; verify fields and counts match DB.

## Risks & Mitigations
- Over-fetching; mitigate by keeping VM payloads lean.

## Rollback
Revert VM modules to last working shapes; keep CRUD untouched.

## Definition of Done
- VM endpoints match documented shapes
- ETags present
- Tests pass
