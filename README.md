# Plantit

Plantit is a sample horticulture management platform featuring a FastAPI backend (VM/M) and a static HTML/ESM frontend composed of thin ViewModels.

## Repository Layout

```
backend/
  app.py               # FastAPI application and router composition
  db.py                # SQLModel engine and session helpers
  models/              # SQLModel entities and Pydantic schemas
  repositories/        # Persistence helpers for CRUD logic
  services/            # Domain services (aggregations, etc.)
  viewmodels/          # Backend view model builders consumed by the frontend
  api/                 # FastAPI routers (health, CRUD, VM)
  tests/               # Pytest suite covering health, CRUD, VM endpoints
  seeds/               # Idempotent demo data seeding script
frontend/
  index.html           # Crisp white shell application
  styles/              # Design tokens and base styles
  js/                  # Router, thin VMs, and view modules
artifacts/
  Phase-A_Repo_Tooling_Hello_VM_M/
  Phase-B_Models_CRUD/
agents/                # Phase instructions and guardrails
plan/                  # Phase-by-phase implementation outline
```

## Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+

### Installation

```bash
make install
```

This installs Python dependencies (including dev tooling) and Node dev dependencies.

### Running the Backend

```bash
make run-backend
```

The backend listens on `http://localhost:8000`, serving the SPA shell at `/` and all API endpoints under `/api/v1`. Available endpoints:
- `GET /api/v1/health`
- `GET/POST/PATCH/DELETE /api/v1/villages`
- `GET/POST/PATCH/DELETE /api/v1/plants`
- `POST /api/v1/plants/{id}/photos`
- `DELETE /api/v1/photos/{id}`
- `GET /api/v1/search`
- `GET /api/v1/tags`
- `GET/POST/PATCH/DELETE /api/v1/care-profiles`
- `GET/POST/PATCH/DELETE /api/v1/tasks`
- `GET /api/v1/vm/home`
- `GET /api/v1/vm/villages`
- `GET /api/v1/vm/village/{id}`
- `GET /api/v1/vm/plant/{id}`
- `GET /api/v1/export?scope=all|village|plant&{id=UUID}`
- `POST /api/v1/import`

### Running with Docker

Build the production container image and start it on port 8080:

```bash
docker build -t plantit .
docker run --rm -p 8080:8080 plantit
```

The container exposes a health check at `http://localhost:8080/api/v1/health` and serves the frontend at `http://localhost:8080/`.

### Frontend Development

Serve the static frontend (for example using `npm run dev`) and ensure the backend is running locally:

```bash
npm run dev
```

By default the frontend expects the backend at `http://localhost:8000`. Override by setting `window.PLANTIT_API_BASE` before loading `router.js` if needed.

The frontend now ships with an installable PWA shell and offline-first behaviors:

- A service worker caches the shell, thin VM modules, and VM GET responses for offline reads.
- Non-GET mutations queue in IndexedDB when the browser is offline and replay automatically once connectivity returns.
- Successive replays trigger thin VMs to refresh and clear any queued notices.

To reset offline state during development, unregister the service worker and clear site data from your browser.

### Tests & Quality Gates

```bash
make test      # Runs pytest suite
make lint      # Ruff + Black + ESLint
make format    # Formats Python code and fixes import ordering
npm test       # Runs frontend thin-VM tests via node:test
```

### Seeding Demo Data

```bash
make seed
```

The seed script is idempotent and populates sample villages, plants, care profiles, and recurring tasks.

## Development Notes

- Follow guardrails in `agents/Global_Guardrails.md` for architecture and error handling.
- All backend GET endpoints return `ETag` headers and respect `If-None-Match`.
- Errors follow the `{ "error": { "code", "message", "field" } }` envelope.
- Media uploads are stored under `backend/data/media` and exposed via `/media/...` URLs with automatic JPEG thumbnails.
- Frontend thin VMs fetch view models via `/api/v1/vm/*` and mutate state via CRUD endpoints, then reload from the backend.
- Export and import JSON bundles (including media manifests) via `/api/v1/export` and `/api/v1/import`. Missing media files are reported as import conflicts to keep the queue idempotent.
- Full-text search is backed by SQLite FTS5; tags are aggregated directly from JSON metadata.
- Care profiles automatically enqueue interval/weekly tasks and the home dashboard surfaces due-today and upcoming workload.
