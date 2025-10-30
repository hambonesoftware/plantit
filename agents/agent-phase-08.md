# Agent Phase 08 — Dashboard Read Path

## Objective
Wire Dashboard read path.

## File Operations
- Backend: `GET /api/dashboard`
- Frontend: `DashboardViewModel` that fetches and renders skeleton → data
- Error and empty states implemented.

## Commands to Run
Open dashboard route and verify cards appear with seed data.

## Verification / Definition of Done
Cards render; retry button works on failure.

## Rollback Plan
Show static placeholders while backend stabilizes.

## Notes
Keep dashboard cheap to render.
