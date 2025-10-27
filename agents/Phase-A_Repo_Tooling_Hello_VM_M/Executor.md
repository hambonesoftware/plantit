# Phase A — Repo, Tooling & Hello VM/M — Executor

## Objective
Clean repo scaffold with FastAPI health endpoint and frontend shell.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-A_Repo_Tooling_Hello_VM_M/summary.json` with:
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
- Initialize repo structure, Makefile, lint/format/test, pre-commit.
- FastAPI app with `GET /api/v1/health -> {"ok": true}`.
- Frontend index.html + minimal JS bootstrap.
- Add agents and plan docs references to README.

## Tests to Write
- `test_health.py`: 200 + JSON schema.
- Lint runs clean (ruff/black, eslint).

## Acceptance Criteria
- `GET /api/v1/health` returns 200 and `{ "ok": true }`.
- Dev loop starts backend and serves frontend.
- Repo tree matches documented structure.

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
