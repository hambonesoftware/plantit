# Plan Orchestrator (plan.md)

This file explains how to use the `/plan_v3` folder to drive Plantit forward using the **VM/M backend + V/thin-VM frontend** approach.

## What is in `/plan_v3`
- `README.md` — architecture summary, tokens excerpt, API namespaces.
- `Phase-*.md` — one doc per phase A–N, each with: Objective, Prerequisites, Detailed Work Items, File Tree Changes, API/UI Contracts, Tests, Manual QA, Risks, Rollback, and Definition of Done.

## How to run a phase
1. Read the phase document in `/plan_v3` (e.g., `Phase-B_Models_CRUD.md`).
2. Implement exactly the **Detailed Work Items**.
3. Keep contracts stable; for reads use `/api/v1/vm/*`, for writes use CRUD under `/api/v1/*`.
4. Write the tests listed under **Tests** while coding.
5. Perform the **Manual QA** checks.
6. Verify every item in **Definition of Done** is satisfied before merging.

## Syncing with agents
If you are using the `/agents_v3` folder:
- Run the matching **Executor.md** prompt for the phase after you have reviewed the plan.
- After the PR is ready, run the **Checker.md** prompt to validate guardrails and acceptance.
- Each phase should upload artifacts under `/artifacts/<PhaseDir>/` (summary.json and checker_report).

## Cross-phase rules
- Backend owns Models and ViewModels. Frontend is Views + thin VMs.
- Thin VMs fetch VM JSON for reads and call CRUD for writes, then refresh the VM.
- All Villages and Plants are persisted; CRUD is complete from Phase B onward.
- Visual spec: crisp white surfaces, thin black borders, soft shadows.
- ETag discipline and error envelope apply to CRUD and VM endpoints.
- Idempotent seeds/migrations; avoid breaking VM shapes once published.

## Phase Index
- Phase A — Repo, Tooling & Hello VM/M
- Phase B — Models & CRUD (Villages/Plants)
- Phase C — Backend ViewModels
- Phase D — Frontend Shell & Thin VMs
- Phase E — UI CRUD Flows
- Phase F — Visual System: Crisp White
- Phase G — Media Pipeline (Photos)
- Phase H — Search (FTS5) & Tags
- Phase I — Dashboard Aggregates
- Phase J — Tasks & Care Profiles (Optional)
- Phase K — Offline & PWA
- Phase L — Export / Import
- Phase M — Accessibility & Polish
- Phase N — Packaging & Deployment

## Change management
- If you change a contract or a Definition of Done, update the corresponding docs in `/plan_v3` and the relevant agent prompts in `/agents_v3`.
- Record edits by adding a small **Change Notes** section at the bottom of the edited phase file.
