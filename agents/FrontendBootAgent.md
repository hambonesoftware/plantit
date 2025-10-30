# FrontendBootAgent

**Objective**
Guarantee first paint with a minimal `index.html` + `app.js`. No router/store/VM.

**You Will:**
- Inline minimal CSS and add a paint-probe div with “SAFEBOOT OK”.
- Add boot markers: set `data-boot="t0"` in HTML, `t1` at app.js start, `t2` after `requestAnimationFrame`.
- Add two buttons: “Ping /api/health” and “Echo”.

**Acceptance Criteria**
- Page paints text without delay.
- Buttons work and log JSON responses.
