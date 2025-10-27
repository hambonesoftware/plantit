# Phase K — Offline & PWA
## Objective
Cache VM GETs and queue mutations for offline replay.

## Prerequisites
- Phases D–J complete (at least D–E).

## Detailed Work Items
1. Add service worker to cache static assets and VM GET responses.
2. Implement IndexedDB-backed request queue for POST/PATCH/DELETE with backoff.
3. Detect connectivity and replay queue; refresh affected VMs.

## File Tree Changes
```
frontend/
  index.html
  styles/{tokens.css, base.css}
  js/
    router.js
    services/apiClient.js
    thinvms/{HomeThinVM.js, VillagesThinVM.js, VillageDetailThinVM.js, PlantDetailThinVM.js}
    views/{home-view.js, villages-view.js, village-detail-view.js, plant-detail-view.js}
```

## API/UI Contracts
- Offline reads via cached VM GETs; mutations enqueued and replayed; UI re-fetches VM on reconnect.

## Tests
- Queue unit tests with retry/backoff; conflict handling tests.

## Manual QA
- Turn API off, perform writes, turn on, verify automatic replay and UI sync.

## Risks & Mitigations
- Stale caches; version caches and bust on deploys.

## Rollback
Clear service worker and caches; leave online-only as fallback.

## Definition of Done
- VMs render offline where cached
- Writes replay on reconnect
- No manual recovery needed
