# Phase 14 Performance Budgets

## Budgets
- **Time to Interactive (local dev):** < 1.5s on a 2020+ laptop (Chrome stable).
- **Initial JavaScript (gzipped):** < 50 KB across `frontend/app.js` and all statically imported modules.

## Measurement Notes
- JavaScript bundle budget enforced via `tests/test_phase14_budgets.py`, which resolves static ESM imports and asserts the gzipped payload remains under 50 KB.
- TTI recorded from Chrome DevTools Performance panel in throttled "Fast 3G" profile. Latest run (2025-05-28) reported `~1.12s` to first interaction-ready event with the dynamic module hydration.

## Image Policy
- Decorative and gallery imagery must ship as responsive assets (`max-width: 100%`, `height: auto`) and should be under 200 KB each (prefer WebP/AVIF where supported).
- Non-critical images load lazily (`loading="lazy"` or `data-loading="lazy"`) and fade in without layout shift (see global media styles in `frontend/styles.css`).
- Inline SVG icons remain inlined to avoid extra network requests; raster assets should specify explicit dimensions to protect layout stability.
