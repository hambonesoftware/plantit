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
