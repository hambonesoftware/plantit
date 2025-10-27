# Phase C — Backend ViewModels — Executor

## Objective
Expose view-ready JSON at `/api/v1/vm/*` for home, villages, village detail, and plant detail.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-C_Backend_ViewModels/summary.json` with:
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
- Implement `vm_home`, `vm_villages`, `vm_village`, `vm_plant` modules.
- Add `/api/v1/vm/home`, `/vm/villages`, `/vm/village/{id}`, `/vm/plant/{id}` routes.
- Compute counts/summaries in services; avoid UI formatting.
- Return ETags; document shapes in OpenAPI examples.

## Tests to Write
- Unit tests asserting exact VM JSON shapes and fields.

## Acceptance Criteria
- VM endpoints return documented shapes; query times acceptable locally.
- ETags present on VM GETs.

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
