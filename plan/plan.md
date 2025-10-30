# Project Plan (Safe-Boot First, One-Port, Paint-Before-Anything)

**Primary Objectives**
1. The app **always paints** something debuggable in <1s: “SAFEBOOT OK”.
2. Frontend and API run on **one port** (default: `http://127.0.0.1:5590`).
3. No router/store/VM work may run before first paint.
4. MIME/CORS/health are validated by a smoke script in every phase.
5. Service Workers (SW) are **forbidden** until Phase 5 and can be force-purged via `?no-sw=1`.

**Phases**
- Phase 0: Safe-Boot (hard requirement to proceed)
- Phase 1: Unified server (FastAPI serves static + SPA fallback) + smoke checks
- Phase 2: Router enable (default route `/`; no “restore last view” yet)
- Phase 3: Views/Store/VM incremental hydration (strict import-cycle + perf guards)
- Phase 4: Extract CSS/assets progressively (keep critical CSS inline)
- Phase 5: Optional Service Worker (opt-in, with `?no-sw=1` bouncer retained)

**Ports**
- Single port: **5590** for both API and frontend in dev (can be configured).

**Acceptance Gates (must pass each phase)**
- `scripts/smoke.sh` or `scripts/smoke.ps1` passes (status + MIME + TTFB).
- Page loads with “SAFEBOOT OK”.
- DevTools opens and shows console logs.
