# Phase B — Models & CRUD (Villages/Plants) — Executor

## Objective
Persist Villages & Plants with complete CRUD and ETags.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-B_Models_CRUD/summary.json` with:
  - status: success|partial|failed
  - changes: [{"path":"...","action":"..."}]
  - api_endpoints: []
  - ui_routes: []
  - notes: ""

## Constraints
- Frontend contains **Views + thin VMs only**.
- Backend exposes stable **CRUD** and **VM** endpoints.
- Respect error envelope and ETag requirements.
- No ellipses in code; idempotent scripts.

## Tools
- Python 3.12, FastAPI, SQLModel, Uvicorn, Pillow (if media phase)
- SQLite (FTS5 available)
- Node 20+ (static hosting or Vite HMR), ESLint

## Implementation Plan
- Define SQLModel `Village` and `Plant` (UUID PKs, timestamps, FKs).
- Implement routers: Villages and Plants full CRUD.
- ETags on GET list/detail; basic pagination optional.
- Seed script for demo data.

## Tests to Write
- CRUD round-trip tests for Villages and Plants.
- FK integrity and validation tests.

## Acceptance Criteria
- All CRUD endpoints pass tests with persistence across runs.
- Responses include stable IDs and ETags.

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
