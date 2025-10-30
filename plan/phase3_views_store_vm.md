# Phase 3 — Views / Store / VM Incremental Hydration

**Goal**
Gradually add Store and VMs after first paint. Never block first paint.

**Rules**
- LocalStorage reads happen via `setTimeout(0)` or after first `requestAnimationFrame`.
- Network fetches must start only after paint.
- Enforce **import-cycle** checks across `components/`, `views/`, `vm/`, `store.js`.
- Enforce **Perf Guard**: no top-level await, no heavy loops on module eval.
- Add a visible, non-blocking “loading…” indicator only inside the app shell.

**Acceptance Tests**
- Smoke suite passes.
- Import-cycle tool reports zero cycles.
- Page paints “SAFEBOOT OK” and then hydrates sections without freezing.
