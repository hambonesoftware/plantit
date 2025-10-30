# SWBouncerAgent

**Objective**
Ensure stale Service Workers can never brick the app.

**You Will:**
- Keep `?no-sw=1` purge snippet in `index.html`.
- Ban SW registration until Phase 5.
- If SW later exists, ensure dev build bypasses HTML caching.

**Acceptance Criteria**
- Visiting `/?no-sw=1` unregisters SW, clears caches/storage, and reloads cleanly.
