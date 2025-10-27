# Phase D — Frontend Shell & Thin VMs
## Objective
Implement router, shell, and thin VMs that fetch `/vm/*` and bind state to views.

## Prerequisites
- Phase C complete.

## Detailed Work Items
1. Build router and shell layout (header, main region).
2. Create thin VMs: Home, Villages, VillageDetail, PlantDetail with `load()` methods.
3. Implement apiClient with ETag support and error normalization.
4. Bind views to VM JSON 1:1 without client-side business logic.

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
- Reads use `/api/v1/vm/*`. Thin VMs expose `state {loading,data,error}`; views read directly.
- Error envelope handled uniformly in the UI.

## Tests
- Thin-VM tests for `load()` success and failure.
- Smoke tests rendering counts/text.

## Manual QA
- Navigate `/`, `/v/:id`, `/p/:id`; verify rendering and 304 flows.

## Risks & Mitigations
- State churn; keep VM payloads stable and caching on.

## Rollback
Rollback to static placeholders and known-good VM reads.

## Definition of Done
- Routes render VM data
- ETag revalidation works
- No business logic in browser
