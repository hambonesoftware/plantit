# Agent Phase 10 — Plants & Today Panel Read Path

## Objective
Plants list and Today panel (read-only).

## File Operations
- Backend: `GET /api/villages/{id}/plants`, `GET /api/today`
- Frontend: `PlantListView`, `TodayPanel` with a manual refresh button (no polling)

## Commands to Run
Open Today panel and trigger refresh; navigate plants by village.

## Verification / Definition of Done
Data populates; UI shows loading and empty states correctly.

## Rollback Plan
Stub Today with a friendly message until backend is ready.

## Notes
Defer polling to a later perf tuning phase.
