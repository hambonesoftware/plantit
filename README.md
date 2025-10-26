# Plantit

Plantit is a local-first garden planner built with a FastAPI backend and a lightweight HTML/ES module frontend.

## Development setup

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn backend.app:app --reload
```

### Frontend

The frontend is a static site served from the `frontend/` directory. You can open `frontend/index.html` directly in a browser or
use any static file server (for example, `python -m http.server` while in the `frontend` directory).

### Tests

Backend tests use `pytest`:

```bash
pytest
```

Frontend unit tests leverage the Node.js test runner:

```bash
npm test
```

## Project structure

- `backend/` — FastAPI application, database models, and tests.
- `frontend/` — HTML, CSS, and ES modules implementing the MVVM client.
- `artifacts/` — Phase execution summaries and checker reports.
- `agents/`, `plan/` — Automation instructions per delivery phase.
