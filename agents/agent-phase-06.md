# Agent Phase 06 — OpenAPI Contracts & Fixtures

## Objective
Author OpenAPI specs and return fixtures that conform.

## File Operations
- Create `backend/openapi.yaml` with schemas for villages, plants, today, dashboard.
- Implement FastAPI routes to serve fixture JSON exactly matching schemas.
- Add a contract test that validates responses against the OpenAPI.

## Commands to Run
Run backend and execute contract tests (pytest).

## Verification / Definition of Done
OpenAPI validation passes; curl endpoints match documented shapes.

## Rollback Plan
Fallback to Phase 01 hello endpoint until schemas are stable.

## Notes
Spec-first prevents client/server mismatch.
