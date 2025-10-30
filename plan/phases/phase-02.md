# Phase 02 - Dev Static Server & SPA Fallback
**Objective:** Serve the frontend with a dev static server on port 5580, with SPA fallback.

**Deliverables:**
- Python `http.server` (or tiny Starlette static app) serving `frontend/`.
- All 404s in dev return `index.html` (history-mode fallback).
- No Service Worker shipped. `?no-sw=1` clears any residual SW from prior builds.

**Definition of Done:**
- Deep URL `http://127.0.0.1:5580/#/villages/3` resolves to the SPA and shows the shell.
- Forcing DevTools shows no blocked paint.
