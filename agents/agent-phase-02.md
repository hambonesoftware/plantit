# Agent Phase 02 — Dev Static Server & SPA Fallback

## Objective
Serve frontend with SPA fallback and no Service Worker.

## File Operations
- Modify the dev static server to map all unknown routes to `/index.html`.
- Add a `?no-sw=1` path in `frontend/app.js` that unregisters any service workers.
- Add a prominent banner in safe mode: 'Safe Mode — Router/Store disabled.'

## Commands to Run
python run.py
# In browser:
http://127.0.0.1:5580/#/villages/3
http://127.0.0.1:5580/?no-sw=1

## Verification / Definition of Done
Deep routes render the shell; SW (if present) is unregistered and disabled.

## Rollback Plan
Remove the fallback handler and SW bouncer if they cause issues.

## Notes
Do not introduce a router yet; only support hash-based anchors visually.
