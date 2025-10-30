# Phase 1 — Unified Server & SPA Fallback

**Goal**
Keep single-port serving. Add SPA fallback: all non-`/api/*` paths return `index.html` if a static file isn’t found.

**Deliverables**
- Extend `run.py` fallback route to serve `index.html` for unknown paths (except `/api/*`).

**Rules**
- Preserve Safe-Boot code and tests.
- Keep critical CSS inline. No external CSS yet.

**Acceptance Tests**
- `scripts/smoke.*` still passes.
- `GET /does/not/exist` → returns index HTML (status 200, text/html).
