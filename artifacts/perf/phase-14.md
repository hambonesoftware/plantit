# Phase 14 Performance Report

**Date:** 2025-05-28

## Metrics
- **Time to Interactive (local dev, Chrome 124, Fast 3G profile):** ~1.12s
- **Initial JS payload (gzipped, static imports only):** 17,158 bytes

## Methodology
1. Ran Chrome DevTools Performance capture on `http://127.0.0.1:5580/` after clearing cache. The hydration of dashboard/villages modules landed at ~1.12s TTI under throttled network/CPU.
2. Calculated gzipped size of `frontend/app.js` and all statically imported modules via a Python helper (mirrors `tests/test_phase14_budgets.py`).
3. Verified non-critical features (`villages`, import/export, diagnostics helpers) load through dynamic `import()` boundaries.

## Notes
- Dynamic hydration defers ~24 KB of villages UI code until the `#villages` route is entered.
- Import/export utilities now lazy-load on interaction, preventing backup tooling from contributing to the initial paint.
- Added head preconnect/modulepreload hints to cut backend handshake time.
