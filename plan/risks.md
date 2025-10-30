# Risks & Mitigations

1) **First paint blocked by script/module error**
   - **Mitigation:** Safe boot gate (`?safe=1`), progressive attach of features, console heartbeat logs each step.

2) **CORS / Port split issues**
   - **Mitigation:** Pre-configured CORS on backend in dev; prod unifies under FastAPI static mount.

3) **Router stuck on last view, blank page**
   - **Mitigation:** Startup route lock to `/` unless `resume=1` present; SPA fallback config; `localStorage` guard.

4) **Service Worker cache poisoning**
   - **Mitigation:** No SW by default. A `?no-sw=1` bouncer clears and disables SW if one exists from older builds.

5) **Schema drift between frontend and backend**
   - **Mitigation:** OpenAPI-first, DTO versioning, schema tests, e2e checks.

6) **Regression on “always paints” guarantee**
   - **Mitigation:** Smoke tests, Playwright E2E, “first paint” watchdog test.
