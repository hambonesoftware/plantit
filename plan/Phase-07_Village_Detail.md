# Phase 07 — Village Detail View
## Objective
Provide plant management within a village: plant grid/list, filters, quick actions, move plant.

## Prerequisites
- Phases 01, 05–06 complete.

## Detailed Work Items
1. `VillageVM(villageId)` with load, filters (tag/state), and quick actions.
2. `<village-view>` with header, filters bar, plant cards.
3. Quick actions: log water, add photo (upload endpoint).
4. Move plant between villages using `POST /api/v1/plants/{id}:move`.

## File Tree Changes
```
frontend/js/viewmodels/VillageVM.js
frontend/js/views/village-view.js
```

## API Contracts
- `GET /api/v1/plants?village_id=...`
- `POST /api/v1/plants/{id}:move`
- `POST /api/v1/plants/{id}/logs`
- `POST /api/v1/plants/{id}/photos`

## Tests
- VM filters derivation; performance on large lists.

## Manual QA
- Apply filters without extra fetch; quick action updates UI immediately.

## Definition of Done
- Smooth scrolling and responsive filter interactions.
