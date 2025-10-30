# Agent Phase 03 — CORS & Startup Route Lock

## Objective
Enable CORS in backend for dev and lock startup route to '/' on first load.

## File Operations
- Add FastAPI CORSMiddleware allowing origin http://127.0.0.1:5580
- In `frontend/app.js`:
  - On first boot (no `resume=1`), force location.hash = '' (home) before any heavy init.
  - Guard reads from localStorage and ignore invalid data.

## Commands to Run
python run.py
# Reload several times; confirm home is stable

## Verification / Definition of Done
No CORS errors; app always opens at home unless `resume=1` is in the query string.

## Rollback Plan
Remove CORS block and startup lock; revert to safe boot only.

## Notes
This prevents 'last bad route' stickiness.
