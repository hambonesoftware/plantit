# Phase 01 - Backend Health & Hello
**Objective:** Provide `/api/health` deep check and a simple `/api/hello` fixture.

**Deliverables:**
- FastAPI app with endpoints:
  - `GET /api/health` returns `{ "status": "ok", "checks": { "db": "ok" } }`.
  - `GET /api/hello` returns `{ "message": "Hello, Plantit" }`.
- Uvicorn config pinned to port 5581.
- Structured JSON logs.

**Definition of Done:**
- `curl http://127.0.0.1:5581/api/health` returns 200 and JSON.
- `run.py` starts backend reliably with colored console logs.
