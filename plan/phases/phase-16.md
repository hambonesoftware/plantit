# Phase 16 - Packaging, Release, and Runbooks
**Objective:** Ship repeatably.

**Deliverables:**
- `run.py` orchestrator (dev) and `serve.py` for unified prod.
- Versioning, changelog, rollback plan.
- Operator runbooks: “first paint blocked” playbook, CORS fallback steps, SW purge command.

**Definition of Done:**
- A new machine can clone, `python run.py`, and see the app in 60 seconds.
