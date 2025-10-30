# Phase 5 — Optional Service Worker

**Goal**
Opt-in PWA features with explicit cache versioning and a **permanent** `?no-sw=1` purge path.

**Rules**
- Only after Phase 0–4 are stable.
- SW must short-circuit and skip caching HTML during dev.
- Keep “SW Bouncer” snippet in `index.html`.

**Acceptance Tests**
- Fresh install: works.
- `?no-sw=1` fully unregisters SW and clears caches.
- Subsequent reloads behave as expected without stale assets.
