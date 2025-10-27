# Phase G — Media Pipeline (Photos) — Executor

## Objective
Upload/delete photos for plants; extend VMs with photo info.

## Context
- Project: Plantit
- Architecture: **Backend VM/M** (FastAPI + SQLModel), **Frontend V/thin-VM** (HTML/CSS/ESM-JS).
- Guardrails: See `/agents_v3/Global_Guardrails.md`.

## Outputs (Artifacts)
- Source changes committed (backend/frontend).
- Tests for this phase.
- Updated README (commands/endpoints if applicable).
- Machine-readable `artifacts/Phase-G_Media_Pipeline_Photos/summary.json` with:
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
- `POST /api/v1/plants/{id}/photos` (multipart) with validation and EXIF.
- Generate `thumb_*.jpg` and store originals under media path.
- Extend VM outputs: `vm/village` items with `has_photo/thumb_url`, `vm/plant` with `photos[]`.
- `DELETE /api/v1/photos/{id}` for cleanup.

## Tests to Write
- Upload/delete integration tests with EXIF parsing and path safety.

## Acceptance Criteria
- 5–10MB images process locally; VM endpoints surface photo data.

## Failure Handling
If time runs out or a step fails:
1) Revert unstable changes.
2) Commit stable subset.
3) Write `summary.json` with "status":"partial" and TODOs in notes.
