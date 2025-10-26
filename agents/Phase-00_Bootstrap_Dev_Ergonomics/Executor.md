# Bootstrap & Dev Ergonomics — Execution Agent

## Objective
Bootstrap & Dev Ergonomics

## Context
- Project: Plantit
- Architecture: FastAPI backend + HTML/CSS/ESM-JS frontend (MVVM on frontend only).
- Data Model (core): Village, Plant, Task, Log, Photo, Settings.
- Local-first; no cloud; no network kill switch.

## Inputs
- Existing repo structure (if prior phases executed).
- This file's instructions.
- Global Guardrails (see `/agents/Global_Guardrails.md`).

## Outputs (Artifacts)
- Source files changed/created as listed under _Implementation Plan_.
- Tests for this phase.
- Updated README with usage notes.
- A MACHINE-READABLE summary file at `artifacts/Phase-00_Bootstrap_Dev_Ergonomics/summary.json` with:
  - `"status": "success" | "partial" | "failed"`
  - `"changes": [{"path":"...", "action":"created|modified|deleted"}]`
  - `"api_endpoints": ["GET /api/v1/..."]` (if applicable)
  - `"ui_routes": ["#/..."]` (if applicable)
  - `"notes": "..."`

## Constraints
- Follow Global Guardrails.
- Keep code self-contained; no hidden steps.
- Idempotent scripts.
- Ensure reproducible results on a clean checkout.

## Tools Available
- Python 3.12, FastAPI, SQLModel, Uvicorn
- SQLite (FTS5)
- Pillow for images
- Node 20+ for static dev server/Vite (dev only)
- Jest/Vitest optional; prefer lightweight VM tests without heavy frameworks

## Implementation Plan
- Repo scaffolding with backend (FastAPI) and frontend (HTML/CSS/ESM-JS) directories
- Uvicorn + Vite dev loop (or static server) with concurrent run command
- Pre-commit hooks, ruff/black/mypy (loose), pytest, ESLint
- Makefile targets: dev, test, fmt, lint
- Health endpoint /api/v1/health

## Tests to Write
- Unit tests for new services/helpers
- Router endpoint tests (200/4xx paths) if API added
- Data constraints/migrations idempotency test
- Health endpoint test: status code 200 and JSON schema

## Acceptance Criteria
- All new/modified endpoints respond as per OpenAPI
- No guardrail violations
- Seed/demo data (if applicable) functions and can be re-run
- Running `make dev` starts backend and frontend concurrently
- `GET /api/v1/health` returns 200 with JSON `{"ok": true}`
- Linting and formatting commands exist and run clean

## Go/No-Go Self-Checks
- [ ] Lint & format pass (ruff/black/ESLint).
- [ ] All tests pass locally.
- [ ] CLI commands in README work as documented.
- [ ] Performance and a11y targets (where applicable) measured.

## Failure Handling
If a step fails or time runs out:
1. Revert broken changes.
2. Commit stable subset.
3. Populate `artifacts/Phase-00_Bootstrap_Dev_Ergonomics/summary.json` with `"status":"partial"` and list TODOs.
4. Leave clear NEXT STEPS at the end of README.
