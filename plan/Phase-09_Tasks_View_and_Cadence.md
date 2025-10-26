# Phase 09 — Tasks View & Scheduling Quality
## Objective
Dedicated tasks screen with batch actions; solid cadence engine for generating next-due items.

## Prerequisites
- Phases 01, 04–08 complete.

## Detailed Work Items
1. Implement cadence service on backend (every N days; weekly on DOW).
2. `TasksVM` with filters and batch actions.
3. `<tasks-view>` with list/table UI; inline reschedule and complete.
4. Idempotent scheduling logic; avoid duplicate future tasks.

## File Tree Changes
```
backend/services/cadence.py
frontend/js/viewmodels/TasksVM.js
frontend/js/views/tasks-view.js
```

## API Contracts
- `GET /api/v1/tasks?state=...`
- `PATCH /api/v1/tasks/{id}` (complete/reschedule)

## Tests
- Cadence boundary tests; batch action tests.

## Manual QA
- Reschedule updates Home mini calendar immediately.

## Definition of Done
- Deterministic scheduling; reliable batch actions.
