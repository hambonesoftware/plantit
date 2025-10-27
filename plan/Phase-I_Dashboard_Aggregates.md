# Phase I — Dashboard Aggregates
## Objective
Enrich Home VM with per-village counts and recent activity for badges.

## Prerequisites
- Phases B–H complete (or at least B–C).

## Detailed Work Items
1. Implement aggregation helpers for plant counts and last-updated per village.
2. Include badges in `vm/home` for each village.
3. Keep VM shapes lean and stable.

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
- `vm/home` returns per-village `plant_count` and optional `last_updated` used in cards.

## Tests
- Aggregate unit tests cross-checked with raw SQL queries.

## Manual QA
- Visual check of badges on Home cards vs DB truth.

## Risks & Mitigations
- Aggregate drift; ensure tests validate counts against DB.

## Rollback
Revert to simpler aggregates while keeping VM endpoints alive.

## Definition of Done
- Accurate aggregates
- VM stable
- Cards display correct badges
