# Phase 08 — Plant Detail (Overview, Care, History, Photos)
## Objective
Deep plant page with tabs, care editor, logs timeline, photos grid with uploads/deletes.

## Prerequisites
- Phases 01–02, 05–07 complete.

## Detailed Work Items
1. `PlantVM(plantId)` exposing state and commands.
2. `<plant-view>` with tabs: Overview, Care, History, Photos.
3. Care form with validation; updates recompute next-due.
4. Photos grid with drag-drop, captions, delete; optimistic thumbnails.
5. ARIA roles for tabs; keyboard navigation support.

## File Tree Changes
```
frontend/js/viewmodels/PlantVM.js
frontend/js/views/plant-view.js
frontend/js/ui/tabs.js
```

## API Contracts
- `GET/PATCH /api/v1/plants/{id}`
- `PUT /api/v1/plants/{id}/care_profile`
- `GET/POST /api/v1/plants/{id}/logs`
- `POST /api/v1/plants/{id}/photos`, `DELETE /api/v1/photos/{id}`

## Tests
- VM command tests; care validation; photo upload error handling.

## Manual QA
- Switch tabs via keyboard, verify ARIA; upload shows immediate thumb.

## Definition of Done
- Stable, accessible plant detail experience.
