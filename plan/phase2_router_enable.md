# Phase 2 — Router Enable (Default / Only)

**Goal**
Introduce the router, but **do not** restore last view or deep links on boot.

**Rules**
- Router must start only **after** first `requestAnimationFrame`.
- Default route is `/` only.
- Any deep link or "restore last view" behavior is disabled until Phase 3.

**Acceptance Tests**
- Page paints “SAFEBOOT OK” before any router code runs.
- Navigation to a simple second route (`/about`) still paints instantly (SPA fallback ok).
