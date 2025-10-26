# Plantit — Full Development Plan
Date: 2025-10-25

This archive contains **one plan file per phase**. Each phase specifies: objective, prerequisites, detailed work items, file tree changes, API/UI contracts, tests, manual QA, risks & mitigations, rollback, definition of done, and artifacts. No timelines are included.

## Architecture Summary
- Backend: Python 3.12, FastAPI, SQLModel (SQLite), Uvicorn, Pillow, SQLite FTS5.
- Frontend: HTML/CSS/ESM-JS, MVVM pattern, native Web Components, optional Vite for dev HMR.
- Storage: `./backend/data/plantit.db`, media at `./backend/data/media/{yyyy}/{mm}/{uuid}.ext` with thumbnails `thumb_{uuid}.jpg`.
- Local-first: Operable entirely offline after first load; request queue optional in Phase 10.

## Conventions
- Repo root:
```
plantit/
  backend/
  frontend/
  scripts/
  tests/
```
- Makefile targets: `dev`, `test`, `lint`, `fmt`, `seed`, `build`, `serve`.
- API base: `/api/v1`
- Routes (initial): `/`, `/v/:id`, `/p/:id`, `/tasks`, `/settings`.
- Accessibility: Keyboard navigable; visible focus; sufficient contrast; reduced-motion respected.
- Security: Input validation, strict media handling, path traversal protection, content-type verification.
