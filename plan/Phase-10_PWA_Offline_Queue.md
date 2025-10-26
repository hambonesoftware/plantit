# Phase 10 — Offline & PWA niceties
## Objective
Graceful offline operation with cached assets and a background request queue for mutations.

## Prerequisites
- Phases 05–09 complete.

## Detailed Work Items
1. Add service worker to cache static assets and GET responses.
2. Implement IndexedDB-backed queue for POST/PATCH/DELETE with backoff.
3. Detect connectivity changes; replay queue automatically; conflict handling.

## File Tree Changes
```
frontend/js/pwa/sw.js
frontend/js/services/requestQueue.js
```

## Tests
- Queue unit tests with simulated offline; retry and conflict scenarios.

## Manual QA
- Disable backend, complete a task, re-enable; verify automatic replay.

## Definition of Done
- Offline UX requires no manual user intervention.
