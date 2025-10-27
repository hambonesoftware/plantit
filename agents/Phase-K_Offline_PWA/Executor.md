# Phase K — Offline & PWA — Executor

## Objective
Cache VM GETs and queue mutations for offline replay.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-K_Offline_PWA/summary.json` with:
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
- Service worker caches static assets and VM GET responses.
- IndexedDB-backed request queue for POST/PATCH/DELETE with backoff.
- Connectivity listener: on reconnect, replay queue and re-fetch VM.

## Tests to Write
- Queue unit tests for retry/backoff and conflict behavior.

## Acceptance Criteria
- Mutations performed offline replay automatically on reconnect.

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
