# Phase F — Visual System: Crisp White
## Objective
Lock the visual tokens and card styles: white surfaces, thin black borders, soft shadows.

## Prerequisites
- Phase E complete (or earlier for styling groundwork).

## Detailed Work Items
1. Create `styles/tokens.css` and refine `styles/base.css`.
2. Apply card class across Home, Village, Plant cards.
3. Ensure visible focus outlines and contrast ≥ 4.5:1.

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

**Design Tokens and Base Styles**
```
:root{
  --bg:#ffffff; --fg:#111111; --muted:#6b7280; --border:#111111;
  --radius:14px; --shadow:0 8px 24px rgba(0,0,0,0.08);
  --gap:16px; --card-pad:16px;
}
.card{background:var(--bg);color:var(--fg);border:1px solid var(--border);
      border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--card-pad);}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:var(--gap);}
```

## API/UI Contracts
- Components consume tokens; cards are visually consistent.
- Focus outlines visible on links and buttons.

## Tests
- Snapshot tests for card and grid classes.
- Manual a11y spot checks.

## Manual QA
- Inspect Home/Village/Plant cards; verify borders, shadows, spacing.

## Risks & Mitigations
- Insufficient contrast; adjust tokens without changing structure.

## Rollback
Revert to prior tokens; keep class names and structure intact.

## Definition of Done
- Tokens exist and applied
- Cards match spec
- Basic a11y satisfied
