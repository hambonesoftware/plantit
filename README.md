# Plantit

Plantit is a local-first garden planner built with a FastAPI backend and a lightweight HTML/ES module frontend.

## Development setup

### All-in-one dev server

Start the FastAPI backend (which also serves the compiled frontend) and load
demo garden data with a single command:

```bash
python run.py
```

The script creates the SQLite database at `backend/data/plantit.db`, seeds it
with a representative set of villages, plants, and tasks, and then launches a
Uvicorn server on <http://127.0.0.1:8000>. Pass `--skip-sample-data` to keep any
existing local records untouched.

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

### Exporting and importing data

Plantit exposes backup endpoints and a matching UI in the **Settings → Export & Import** view.

- `GET /api/v1/export?scope=all|village|plant&target_id=<id>` returns a JSON bundle plus a media manifest.
- `POST /api/v1/import` accepts a previously exported bundle and restores villages, plants, tasks, logs, and photos.

The frontend downloads exports as `plantit-<scope>-export-<timestamp>.json` files. Import results surface any conflicts (for
example missing media files) both in the UI activity log and via the API response.

### Container image

A multi-stage Dockerfile is included for production packaging. Build and run the container locally with:

```bash
docker build -t plantit .
docker run --rm -p 8080:8080 plantit
```

The container serves the frontend at <http://localhost:8080/> and the API under `/api/v1`. A lightweight health endpoint lives
at `/api/v1/health`, which also powers the container health check.

### Offline mode & PWA

- The frontend registers a service worker from `/js/pwa/sw.js` to cache static assets and GET API responses. When serving the app
  locally make sure the compiled assets are available at the same paths so the worker can precache them.
- Mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) automatically enqueue into an IndexedDB-backed request queue whenever
  the browser is offline or encounters a network error. The queue retries with exponential backoff and replays mutations once
  connectivity returns.
- While offline you can continue completing tasks or making edits. Plantit will show a banner toast noting that changes are
  queued; once the device is back online the service worker flushes the queue and refreshes the dashboard.
- To test the flow manually, load the app, toggle your browser’s offline tools, complete a task, and then restore connectivity.
  You should see a "queued" toast immediately and a success toast after the request replays.

## Project structure

- `backend/` — FastAPI application, database models, and tests.
- `frontend/` — HTML, CSS, and ES modules implementing the MVVM client.
- `artifacts/` — Phase execution summaries and checker reports.
- `agents/`, `plan/` — Automation instructions per delivery phase.
