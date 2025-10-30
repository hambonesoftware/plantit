# Agent Phase 00 — First Paint & Safe Boot

## Objective
Create minimal frontend and orchestrator that guarantees a visible first paint and heartbeat logs.

## File Operations
- Create `frontend/index.html` with inline-safe minimal HTML (no frameworks). It must include:
  - `<div id="app">Loading…</div>` placeholder
  - `<script type="module" src="./app.js"></script>` as the ONLY script tag
- Create `frontend/app.js` with:
  - console.info logs for 'Boot: pre-init' → 'Boot: DOM ready' → 'Boot: shell mounted'
  - A `safeBoot` flag that activates when `?safe=1` is present
  - DOMContentLoaded listener that sets `#app` text to 'Plantit — Safe Shell' when in safe mode
- Create `run.py` that:
  - Starts a dev static server on port 5580 pointed at `frontend/`
  - Starts FastAPI backend on port 5581
  - Prints clear start/stop instructions

## Commands to Run
python run.py
# Then open http://127.0.0.1:5580/?safe=1

## Verification / Definition of Done
- Page renders visible text within 200ms locally.
- Console shows the three boot logs in order.
- No network requests are made in safe mode.

## Rollback Plan
Revert created files and verify the dev static server still serves a bare index.html.

## Notes
Do NOT introduce any router/store code in this phase.
