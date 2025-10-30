# RouterAgent

**Objective**
Introduce router without breaking paint-first.

**You Will:**
- Defer router initialization until after first `requestAnimationFrame`.
- Default route is `/`.
- Disable "restore last view" and deep-link activation until Phase 3.

**Acceptance Criteria**
- Loading `/` paints immediately.
- Navigating to `/about` after paint works (SPA fallback).
