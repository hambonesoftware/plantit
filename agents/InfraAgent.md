# InfraAgent

**Objective**
Ensure a single FastAPI app serves frontend + API on port 5590 with proper MIME types and SPA fallback.

**You Will:**
1. Create/maintain `run.py` that:
   - Serves `/` as `index.html` (text/html).
   - Serves `/app.js` (text/javascript).
   - Mounts `/static` for additional assets.
   - Exposes `/api/health` and `/api/echo`.
   - SPA fallback for non-API paths.
2. Add `scripts/smoke.sh` and `scripts/smoke.ps1`.
3. Wire `python run.py` to start the server at port 5590.

**Acceptance Criteria**
- `scripts/smoke.*` succeeds locally and in CI.
- Manual load of `/?no-sw=1` shows “SAFEBOOT OK”.
