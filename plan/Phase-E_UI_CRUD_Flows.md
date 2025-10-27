# Phase E — UI CRUD Flows
## Objective
Enable create/update/delete for villages and plants from the UI using thin VMs.

## Prerequisites
- Phase D complete.

## Detailed Work Items
1. Add forms/modals for create and edit (Village, Plant).
2. On submit, call CRUD endpoints; then re-fetch the relevant VM endpoint.
3. Show friendly validation messages using error envelope.

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
- Writes: `/api/v1/villages` and `/api/v1/plants` (POST/PATCH/DELETE). Then refresh `/api/v1/vm/*`.

## Tests
- UI tests for create/update/delete happy paths and validation failures.

## Manual QA
- Create and edit items; verify re-fetch and UI updates are correct.

## Risks & Mitigations
- Overposting or stale state; always refresh VM after writes.

## Rollback
Revert to read-only views if unstable; keep CRUD working via curl.

## Definition of Done
- All CRUD operations usable in UI
- State syncs by re-fetching VM
- Errors display cleanly
