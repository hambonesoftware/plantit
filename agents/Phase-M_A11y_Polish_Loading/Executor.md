# Phase M — Accessibility & Polish — Executor

## Objective
A11y pass, skeleton loaders, and reduced-motion support.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-M_A11y_Polish_Loading/summary.json` with:
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
- Add skeletons for Home and Village while VM loads.
- Ensure focus-visible styles and color contrast ≥ 4.5:1.
- Respect `prefers-reduced-motion`.

## Tests to Write
- Basic a11y checks; snapshot tests for skeletons.

## Acceptance Criteria
- Lighthouse a11y ≥ 95; smooth loading states.

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
