# Phase 00 - First Paint & Safe Boot
**Objective:** Guarantee the app always renders a visible shell and a heartbeat log.

**Deliverables:**
- `frontend/index.html` minimal markup renders instantly.
- `frontend/app.js` writes: “Boot: pre-init”, “Boot: DOM ready”, “Boot: shell mounted”.
- Safe boot switch: `?safe=1` disables router, store, and heavy init.
- `run.py` launches both servers: static server on 5580 and FastAPI on 5581.

**Definition of Done:**
- Navigating to `http://127.0.0.1:5580/` shows visible header text within 200ms on local machine.
- Console shows three boot logs in order.
- No fetch calls happen in `?safe=1` mode.
