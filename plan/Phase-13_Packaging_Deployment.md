# Phase 13 — Packaging & Deployment
## Objective
Serve frontend from FastAPI in production; containerize for single-command run.

## Prerequisites
- All prior phases complete.

## Detailed Work Items
1. Production static serving from FastAPI (`/` -> index.html; assets under `/static`).
2. Dockerfile multi-stage build: install Python deps; copy frontend assets; expose 8080.
3. Healthcheck endpoint for container; compose file (optional).

## File Tree Changes
```
Dockerfile
backend/app.py            # ensure static mounting
frontend/dist/            # if using Vite build; else copy src
```

## Tests
- Container healthcheck; start/stop; smoke tests inside container.

## Manual QA
- Run a container and open http://localhost:8080 to verify the full app works.

## Definition of Done
- Portable container starts the full, wired application.
