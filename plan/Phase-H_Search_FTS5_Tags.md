# Phase H — Search (FTS5) & Tags
## Objective
Provide global search and tags endpoint; optional hookup in shell.

## Prerequisites
- Phases B–G complete.

## Detailed Work Items
1. Create FTS5 index on plants; triggers maintain index on write.
2. Add `GET /api/v1/search?q=` with typed results (plant or village).
3. Add `GET /api/v1/tags` returning tag counts.

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
- Search endpoint returns results with `type`, `id`, `title`, `snippet`.
- Tags endpoint returns `{ "tag": string, "count": number }`.

## Tests
- Ranking tests; index maintenance tests.

## Manual QA
- Run sample queries and validate top results and tag counts.

## Risks & Mitigations
- Slow queries; keep FTS payload small and indexed fields focused.

## Rollback
Disable FTS triggers and rebuild index from base tables.

## Definition of Done
- Search returns relevant hits
- Tag counts correct
- Index stays in sync
