# Agents Guide for Plantit (`agents.md`)

This document explains how to use the **/agents** folder to drive the project forward phase-by-phase with clear execution prompts, guardrails, and verification steps.

---

## What’s inside `/agents`

```
/agents/
  Global_Guardrails.md         # Non‑negotiable constraints for the entire project
  Phase-00_Bootstrap_Dev_Ergonomics/
    Executor.md                # Do the work for the phase
    Checker.md                 # Verify that work meets acceptance criteria
  Phase-01_Data_Model_and_CRUD/
    Executor.md
    Checker.md
  ...
  Phase-13_Packaging_Deployment/
    Executor.md
    Checker.md
```

Each **phase** ships two prompts:
- **Executor.md** — The instructions for the agent (or human) that *implements* the phase.
- **Checker.md** — The independent verification instructions to *validate* outputs, acceptance criteria, and guardrails.

There is also an `/artifacts` directory used by the agents to leave machine-readable summaries and reports:
```
/artifacts/
  Phase-06_Home_View/
    summary.json              # Produced by Executor (required)
    checker_report_Phase-06_Home_View.md  # Produced by Checker (required)
```

> The **plan.zip** archive (separate) contains per‑phase plans with deeper breakdowns (file trees, contracts, tests, QA steps). Use it as a reference while running phases.

---

## Core Principles

1. **Follow the guardrails** in `Global_Guardrails.md` at all times (stack lock, local-first, a11y, performance targets, no kill switch, deterministic builds, no ellipses in code).
2. **One phase at a time.** Phases are shippable, cumulative increments.
3. **Artifacts or it didn’t happen.** Every Executor run must emit a `summary.json`; every Checker run must emit a `checker_report_<phase>.md`.
4. **Idempotent & reversible.** Re-running a phase should not break the repo. If partial, mark `"status":"partial"` and list TODOs.
5. **Separation of concerns.** MVVM is client-side only; the backend uses domain models, services, and routers.

---

## Quick Start

1. **Unpack** the `agents.zip` into your project’s root so the `/agents` folder exists exactly as shown.
2. **Read** `/agents/Global_Guardrails.md` once. Keep it open during execution.
3. **Choose a phase** (start at Phase 00 unless otherwise specified).
4. **Run the Executor**: Provide the contents of `Phase-XX/Executor.md` to your build agent (or follow it manually).
5. **Run the Checker**: After changes land, provide `Phase-XX/Checker.md` to an independent agent (or follow it manually). Do not combine executor & checker roles.
6. **Gate**: Only merge when the Checker report says **PASS** and the acceptance criteria are met.

---

## Using the Executor (per phase)

The `Executor.md` includes:
- **Objective** and **Implementation Plan** (what to build/change)
- **Tools** (what runtimes/libraries are allowed)
- **Outputs** (source changes + tests + README updates)
- **Constraints** (must respect Global Guardrails)
- **Tests to Write** and **Acceptance Criteria**
- **Failure Handling** (how to deliver partial but stable work)

**Execution steps:**

1. Ensure you’re on a **feature branch** (e.g., `feat/phase-06-home`).
2. Follow the **Implementation Plan** exactly. Do **not** deviate on stack/structure.
3. Keep commits scoped and conventional.
4. On completion (even partial), create `/artifacts/<PhaseDir>/summary.json` with the required schema (see below).
5. Open a PR referencing the phase and attach the artifact files.

**Required** `summary.json` schema (minimum):
```json
{
  "status": "success",
  "changes": [
    { "path": "frontend/js/viewmodels/HomeVM.js", "action": "created" },
    { "path": "backend/api/dashboard.py", "action": "modified" }
  ],
  "api_endpoints": ["GET /api/v1/dashboard", "PATCH /api/v1/tasks/{id}"],
  "ui_routes": ["#/","#/tasks"],
  "notes": "Implemented dashboard aggregates and wired Home view. Added tests."
}
```
- `status`: `"success" | "partial" | "failed"`
- `changes`: List of file paths with actions `"created"|"modified"|"deleted"`
- `api_endpoints` / `ui_routes`: Only if applicable to the phase
- `notes`: Short description of decisions, caveats, and TODOs

If the phase is **partial**, the Executor must include a `"TODO"` list in `notes` with blocking items and recommended next steps.

---

## Using the Checker (per phase)

The `Checker.md` validates the work product and ensures compliance with guardrails.

**Checker steps:**

1. Read `/agents/Global_Guardrails.md` and the phase’s acceptance criteria.
2. Inspect the diff for scope creep and unexpected file churn.
3. Run the full test suite and linting:
   ```bash
   make lint || true
   make fmt  || true
   make test
   ```
   (If `make` targets aren’t present yet, follow the phase’s specific commands in Executor.md.)
4. Perform the **Behavioral Checks** listed in `Checker.md` (e.g., run the app, use an endpoint/UI flow).
5. Measure performance/a11y if the phase specifies targets.
6. Produce `/artifacts/<PhaseDir>/checker_report_<PhaseDir>.md` including:
   - **Summary:** pass/fail/partial
   - **Evidence** for each acceptance criterion
   - **Guardrail violations** (if any) and remediation steps
   - **Endpoints/Routes affected**
   - **TODOs** and follow-ups

> If you find a **critical guardrail violation**, the Checker must **stop** and produce a remediation task list instead of attempting fixes.

---

## Typical End-to-End Flow (example: Phase 06 — Home View)

1. **Executor**
   - Check out `feat/phase-06-home`.
   - Implement `HomeVM` + UI components, wire `/api/v1/dashboard` and task actions.
   - Add unit tests for optimistic updates and derived counts.
   - Update README with any new commands/notes.
   - Emit `/artifacts/Phase-06_Home_View/summary.json` (status `success` or `partial`).

2. **Checker**
   - Verify no guardrail violations (e.g., no new frameworks, local-first OK).
   - Run `make test`; inspect coverage for new code.
   - Manually complete a “Today” task in UI; see chips update immediately.
   - Produce `/artifacts/Phase-06_Home_View/checker_report_Phase-06_Home_View.md` with a clear PASS verdict.

3. **Merge**
   - PR merges only if **Checker** report is PASS and acceptance criteria are evidenced.

---

## CI recommendations (optional)

- **Lint/Test gate** per PR:
  - Backend: `ruff`, `black --check`, `pytest -q`
  - Frontend: `eslint`, minimal VM tests (if present)
- **Artifacts preservation:** Upload `/artifacts/**` as PR assets for traceability.
- **Branch naming**: `feat/phase-XX-*`, `fix/phase-XX-*`.

---

## Adding a New Phase

1. Create `/agents/Phase-<NN>_<Name>/Executor.md` and `Checker.md`.
2. Mirror the structure used by existing phases (objective, outputs, tests, acceptance).
3. Append a new plan file in the plan archive (optional but recommended).
4. Ensure the new phase does not violate **Global Guardrails**.

---

## Troubleshooting

- **“Remote contains work you do not have” on push**  
  Fetch and rebase before pushing:
  ```bash
  git fetch origin
  git pull --rebase origin main
  git push -u origin main
  ```

- **Port conflicts for dev servers**  
  Configure ports via `.env` and ensure `Makefile` reads them.

- **DB resets during development**  
  The SQLite database lives at `./backend/data/plantit.db`. If you need a clean slate, stop the app, remove the file, and run the seed script.

- **Artifacts missing**  
  The Checker must fail the phase if `summary.json` or checker report is absent.

---

## Glossary

- **Executor**: The agent or human implementing the phase.
- **Checker**: The independent agent or human confirming acceptance & guardrails.
- **Guardrails**: Project-wide constraints that must never be violated.
- **Artifacts**: Machine-readable outputs that prove work was done and verified.
- **Phase**: A self-contained, mergeable unit of work with explicit acceptance criteria.

---

## Final Notes

- Keep phases **focused** and **reproducible**.
- Prefer **small, frequent PRs** to reduce risk.
- When in doubt, **consult `Global_Guardrails.md`** and the phase’s **acceptance criteria**.
