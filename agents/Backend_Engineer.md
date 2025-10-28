# Backend_Engineer
**Goal:** FastAPI app serving APIs and static frontend; single entry `python run.py`.
- Routers: `/api/villages`, `/api/plants`, `/api/tasks`, `/api/logs`, `/api/dashboard`, `/health`.
- DB: SQLite (`app.db`) via SQLAlchemy.
- CORS: allow `http://localhost:3600` if needed; but default serve static on same port to avoid CORS.
- Static: mount `/` → `/app/frontend` index.html.

## Acceptance
- Fresh DB on first run with seed data.
- All CRUD endpoints tested by pytest.
