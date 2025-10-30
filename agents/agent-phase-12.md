# Agent Phase 12 — Observability & Error Taxonomy

## Objective
Add observability with correlation ids and error taxonomy.

## File Operations
- Client: requests include `x-correlation-id`; server echoes to responses/logs.
- Error panels map taxonomy to friendly messages, include 'Copy details' button.
- `/api/health` adds app version and build hash.

## Commands to Run
Force an error and verify correlation id across client/server logs.

## Verification / Definition of Done
Operator can trace a single request through logs via id.

## Rollback Plan
Remove id propagation but keep error messages intact.

## Notes
Keep pii out of logs; scrub payloads where needed.
