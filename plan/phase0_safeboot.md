# Phase 0 — Safe-Boot (Must Paint)

**Goal**
Render a visible “SAFEBOOT OK” plus two test buttons (ping/echo), with API on the same port.

**Deliverables**
- `run.py` (FastAPI): serves `/`, `/app.js`, `/api/health`, `/api/echo`, and static directory.
- `frontend/index.html`: inline critical CSS, SW purge (`?no-sw=1`), paint probe.
- `frontend/app.js`: tiny module, sets boot markers, attaches buttons, pings API.
- `scripts/smoke.sh` + `scripts/smoke.ps1`: verify status, content-type, and latency.

**Rules**
- No router, store, VM, or large imports.
- No external CSS; minimal inline styles only.
- No Service Worker registration allowed.

**Acceptance Tests**
- `curl -i /` → `200 text/html`, body contains `SAFEBOOT OK`.
- `curl -i /app.js` → `200 text/javascript`.
- `curl -i /api/health` → `200 application/json` with `{"ok": true, ...}`.
- Manual: open `http://127.0.0.1:5590/?no-sw=1` → see “SAFEBOOT OK” within 1s.
