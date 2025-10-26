# Phase 06 — Home (Villages) View
## Objective
Implement the homepage UI exactly as previewed: village cards grid with counts and chips, Today checklist, mini calendar, Export/Import links.

## Prerequisites
- Phases 04–05 complete.

## Detailed Work Items
1. Create `HomeVM` with `loadDashboard`, `quickAddPlant`, derived totals.
2. Create `<home-view>` component rendering title, New Village button, cards grid.
3. Create `<today-panel>` component for checklist and mini calendar.
4. Wire optimistic completion for tasks and quick-add plants.
5. Style chips, cards, buttons, and mini calendar with tokens.

## File Tree Changes
```
frontend/js/viewmodels/HomeVM.js
frontend/js/views/home-view.js
frontend/js/views/today-panel.js
frontend/assets/icons/check.svg
frontend/assets/icons/plus.svg
```

## API/UI Contracts
- Uses `GET /api/v1/dashboard`, `POST /api/v1/plants`, `PATCH /api/v1/tasks/{id}`.

## Tests
- HomeVM unit tests for optimistic flows and derived values.

## Manual QA
- Complete a task and see chip counts and Today list update instantly.

## Definition of Done
- Visual parity to preview; interactions feel instant and robust.
