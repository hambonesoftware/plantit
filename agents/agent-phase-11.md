# Agent Phase 11 — Write Paths & Transactional UI

## Objective
Enable write paths with validation and optimistic UI.

## File Operations
- Backend: POST/PUT/DELETE for Villages and Plants; return `etag` or `updated_at`.
- Frontend: Forms with client validation; optimistic UI with rollback on failure.

## Commands to Run
Perform create/edit/delete flows and observe rollback on forced failure.

## Verification / Definition of Done
Mutations persist and UI remains consistent on errors.

## Rollback Plan
Disable optimistic updates and fall back to server-confirmed state.

## Notes
Show toasts with correlation ids for failed requests.
