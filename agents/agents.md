# Agents Orchestrator
Use these agents sequentially. Each agent produces PRs/patches that must keep the app offline-first and self-hosted. No CDNs, no npm. Frontend = HTML/CSS/ESM-JS. Backend = FastAPI. Entry = `python run.py`.

## Order
1) UX_Designer → 2) Frontend_Engineer → 3) Backend_Engineer → 4) Data_Modeler → 5) API_Integrator → 6) QA_Tester → 7) Accessibility_Reviewer → 8) Security_Review → 9) DevOps_Packager → 10) Docs_Writer

Each agent must:
- Respect the design tokens.
- Avoid adding external services.
- Provide acceptance notes and a self-checklist.


## New Agent: VM_Contract_Gatekeeper
Run after Backend_Engineer and before API_Integrator.
