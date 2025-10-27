# Phase M — Accessibility & Polish
## Objective
A11y pass, skeleton loaders, and reduced motion.

## Prerequisites
- Phases D–L complete.

## Detailed Work Items
1. Add skeleton loaders for Home and Village while VM loads.
2. Ensure focus-visible styles and label associations; respect prefers-reduced-motion.
3. Run Lighthouse/axe and remediate.

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
- No new endpoints; purely UI polish and performance.

## Tests
- Snapshot tests for skeletons; a11y checks with tooling where available.

## Manual QA
- Keyboard-only navigation and focus order check across core views.

## Risks & Mitigations
- Over-animated transitions; gate with prefers-reduced-motion.

## Rollback
Disable transitions temporarily; keep skeletons simple.

## Definition of Done
- A11y score ≥ 95
- Clean focus navigation
- Visible loading states
