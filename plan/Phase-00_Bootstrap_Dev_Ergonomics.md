# Phase 00 — Bootstrap & Dev Ergonomics
## Objective
Establish a clean repository with fast dev loop, linting/formatting, basic tests, and a working `/api/v1/health` endpoint plus a static frontend host for development.

## Prerequisites
- Python 3.12 and Node 20+ installed locally.

## Detailed Work Items
1. Initialize repository structure and toolchain.
2. Create `Makefile` with `dev`, `test`, `lint`, `fmt`, `seed` targets.
3. Add dependency pins (`backend/requirements.txt`).
4. Bootstrap FastAPI app with `/api/v1/health` returning `{"ok": true}`.
5. Configure ruff, black, mypy (loose), pytest.
6. Setup frontend static dev server (Vite recommended) with `index.html` placeholder.
7. Add pre-commit configuration for ruff/black/isort and ESLint.

## File Tree Changes
```
plantit/
  backend/
    app.py
    api/
      __init__.py
      health.py
    config.py
    db.py
    requirements.txt
    tests/
      test_health.py
  frontend/
    index.html
    styles/base.css
    js/main.js
    js/router.js
  scripts/
    dev.py
  Makefile
  .editorconfig
  pyproject.toml
  .eslintrc.cjs
  .prettierrc
  .pre-commit-config.yaml
```

## API Contract
- `GET /api/v1/health` → `200`, body: `{ "ok": true }`

## Tests
- `backend/tests/test_health.py`: asserts 200 and schema.

## Manual QA
- Run `make dev` and open the app; verify the health check indicator.

## Risks & Mitigations
- Port conflicts: Expose configurable ports via `.env` read in `Makefile`.

## Rollback
- Safe: remove new files; no DB yet.

## Definition of Done
- Dev loop works; health endpoint green; lint/test clean; repo tree matches the listing.
