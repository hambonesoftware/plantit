# Frontend_Engineer
**Goal:** Build the app in pure HTML/CSS/ESM-JS (no npm).

## Files
- `/app/frontend/index.html`
- `/app/frontend/static/css/theme.css`, `/app/frontend/static/css/app.css`
- `/app/frontend/static/js/app.js` (bootstraps)
- `/app/frontend/static/js/router.js`
- `/app/frontend/static/js/apiClient.js`
- `/app/frontend/static/js/store.js` (EventEmitter, persistence of preferences)
- `/app/frontend/static/js/components/*.js` (ESM: AppShell, VillageCard, Badge, Calendar, Toast)
- `/app/frontend/static/js/views/DashboardView.js`, `VillageView.js`

## Rules
- ESM only: `type="module"`.
- No external fonts/scripts.
- Accessibility: use semantic HTML; ARIA for badges/calendar.
- Include a tiny utility `static/js/lib/dom.js` (qs/qsa, el, h).

## Acceptance
- Dashboard renders from `/api/dashboard`.
- “Quick add plant” opens modal, creates Plant, updates counts without reload.
