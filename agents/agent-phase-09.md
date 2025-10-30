# Agent Phase 09 — Villages Read Path

## Objective
Villages list and detail (read-only).

## File Operations
- Backend: `GET /api/villages`, `GET /api/villages/{id}`
- Frontend: `VillageListView`, `VillageDetailView` with hash navigation

## Commands to Run
Navigate list → detail; reload deep link.

## Verification / Definition of Done
Deep links functional; SPA fallback preserves rendering.

## Rollback Plan
Render list only if detail is unstable.

## Notes
Hash router is sufficient; avoid history API in dev.
