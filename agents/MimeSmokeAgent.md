# MimeSmokeAgent

**Objective**
Validate status, MIME types, and basic latency.

**You Will:**
- Run `scripts/smoke.sh` (Linux/macOS) or `scripts/smoke.ps1` (Windows).
- Require:
  - `/` → 200 text/html
  - `/app.js` → 200 text/javascript
  - `/api/health` → 200 application/json with {"ok":true}

**Acceptance Criteria**
- Smoke scripts succeed locally and in CI.
