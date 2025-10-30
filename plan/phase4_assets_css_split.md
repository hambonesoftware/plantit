# Phase 4 — Assets & CSS Extraction

**Goal**
Move from inline critical CSS to external CSS with proper preload/fallback — but keep paint-first.

**Rules**
- Keep a minimal inline critical CSS block for layout & typography.
- Load additional CSS non-blocking (`rel="preload"` + `onload` swap or `media="print"` trick).
- Ensure correct `Content-Type: text/css` for styles.

**Acceptance Tests**
- No regression on time-to-first-paint.
- CSS loads do not block initial render.
