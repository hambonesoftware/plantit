# Phase D — Frontend Shell & Thin VMs — Executor

## Objective
Implement router, shell, and thin VMs that load `/vm/*` and manage state.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-D_Frontend_Shell_ThinVMs/summary.json` with:
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
- Build router and shell layout (header, main).
- Implement thin VMs: Home, Villages, VillageDetail, PlantDetail with `load()` methods.
- Wire views to bind directly to VM JSON.
- Add `apiClient` with ETag support and normalized errors.

## Tests to Write
- Thin-VM tests: `load()` sets state; error path handled.
- View smoke tests: render counts/text from VM JSON.

## Acceptance Criteria
- Navigating `/`, `/v/:id`, `/p/:id` renders data from VM endpoints.
- ETag revalidation works (304 handled gracefully).

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
