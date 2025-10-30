# Agent Phase 01 — Backend Health & Hello

## Objective
Implement FastAPI with `/api/health` and `/api/hello` plus structured logs.

## File Operations
- Create `backend/app.py` with FastAPI and two endpoints:
  - GET /api/health → returns status ok and a db=ok placeholder
  - GET /api/hello → returns message 'Hello, Plantit'
- Update `run.py` to launch Uvicorn for `backend.app:app` on port 5581.
- Add `requirements.txt` with fastapi, uvicorn[standard], pydantic.

## Commands to Run
python -m pip install -r requirements.txt
python run.py
curl -s http://127.0.0.1:5581/api/health
curl -s http://127.0.0.1:5581/api/hello

## Verification / Definition of Done
Both endpoints return 200 with expected JSON; console shows structured logs.

## Rollback Plan
Comment out backend launch in run.py and re-test frontend safe mode.

## Notes
Keep the response JSON minimal and documented.
