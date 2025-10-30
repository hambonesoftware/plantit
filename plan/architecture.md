# Architecture & Boundaries

## MVVM
- **Views (frontend):** DOM-only templates, no direct state mutations, subscribe to a thin ViewModel.
- **Thin ViewModels (frontend):** Translate user events ↔ service calls; never own business logic; never reach into `localStorage` directly.
- **Full ViewModels (backend):** All business rules, validation, and orchestration live here (FastAPI services layer). Frontend calls REST endpoints only.

## Data & Contracts
- **OpenAPI-first:** Every endpoint is specified in `openapi.yaml` before implementation.
- **DTOs:** Request/Response schemas are versioned. No “shape drift.”
- **Persistence:** SQLite + migrations. Seed data for demo/fixtures.

## Loading Guarantees
- Minimal `index.html` and `app.js` render a placeholder immediately.
- `?safe=1` URL param forces the safe boot (no store, no router, no heavy services).

## SPA Fallback
- Frontend web server maps 404s to `/index.html` (history mode).

## Observability
- Structured logs (client + server) with correlation ids.
- `/api/health` deep checks DB + filesystem.
