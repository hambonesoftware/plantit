# Phase 03 - CORS & Startup Route Lock
**Objective:** Ensure frontend can call backend in dev with CORS, but default to `/` route.

**Deliverables:**
- Backend CORS allowlist for `http://127.0.0.1:5580`.
- Frontend startup route lock: unless `?resume=1`, force to `/` (home) on first load.
- LocalStorage guard: invalid or huge values ignored.

**Definition of Done:**
- From a cold start, app always opens to `/`.
- API calls succeed without CORS errors in DevTools.
