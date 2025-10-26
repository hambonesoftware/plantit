# Plan Guide for Plantit (`plan.md`)

This document explains how to use the **/plan** folder as the operational blueprint for building Plantit phase by phase. It pairs with the `/agents` folder, which contains the execution and checking prompts.

---

## What lives in `/plan`

```
/plan/
  README.md
  Phase-00_Bootstrap_Dev_Ergonomics.md
  Phase-01_Data_Model_and_CRUD.md
  Phase-02_Media_Uploads_Thumbs_EXIF.md
  Phase-03_Search_FTS5_and_Tags.md
  Phase-04_Dashboard_Aggregates.md
  Phase-05_Frontend_Shell_MVVM.md
  Phase-06_Home_View.md
  Phase-07_Village_Detail.md
  Phase-08_Plant_Detail.md
  Phase-09_Tasks_View_and_Cadence.md
  Phase-10_PWA_Offline_Queue.md
  Phase-11_Export_Import.md
  Phase-12_Visual_Polish_A11y.md
  Phase-13_Packaging_Deployment.md
```

Each **phase plan** is a human- and agent-readable specification that describes exactly what to build in that phase and how to validate it. Plans are more descriptive than the executor prompts; they include design intent, file tree changes, contracts, tests, and QA instructions.

> The `/agents` folder tells an agent *how to act*. The `/plan` folder tells the team *what to build and why* for each phase.

---

## How to use the plans with the agents

1. **Pick a phase** (start at Phase 00 unless you explicitly need a later phase).  
2. **Read the phase plan** in `/plan/Phase-XX_*.md` to understand objectives, work items, and contracts.  
3. **Run the matching agent** from `/agents/Phase-XX_*/Executor.md` to implement the plan.  
4. **Run the checker** from `/agents/Phase-XX_*/Checker.md` to verify the implementation.  
5. **Gate the merge** only after the checker report shows PASS and the plan’s Definition of Done is satisfied.

---

## What each phase plan contains

Every phase document follows the same structure:

- **Objective**: What this phase delivers and why it exists.  
- **Prerequisites**: Which earlier phases or tools must be ready.  
- **Detailed Work Items**: The exact tasks to complete, step by step.  
- **File Tree Changes**: Concrete files and directories to add or modify.  
- **API/UI Contracts**: Endpoints, schemas, routes, state shapes required by the phase.  
- **Tests**: Unit, integration, VM tests to write.  
- **Manual QA**: Human steps to verify behavior.  
- **Risks and Mitigations**: Foreseeable pitfalls with concrete preventions.  
- **Rollback**: Steps to safely undo the phase’s changes.  
- **Definition of Done**: The checklist that must be true for the phase to ship.

Each plan is written to be **idempotent**: re-running the steps should not corrupt the repo, database, or artifacts.

---

## Cross-folder coordination

- **/plan ↔ /agents**: For each phase, the plan describes the work and the executor prompts carry out that work. Keep them in sync. If the plan changes, update the executor and checker prompts in `/agents` accordingly.  
- **/plan ↔ /artifacts**: Executors should emit `artifacts/Phase-XX_*/summary.json` and Checkers should emit `artifacts/Phase-XX_*/checker_report_Phase-XX_*.md`. The plan’s Definition of Done expects these artifacts to exist.

---

## Working a phase from the plan

1. **Create a branch** named `feat/phase-XX-short-name`.  
2. **Follow the Detailed Work Items** from the phase plan precisely.  
3. **Adhere to contracts**: If the plan says to expose `GET /api/v1/dashboard`, ensure the response matches the documented shape and examples.  
4. **Write the tests** specified in the plan before or during implementation.  
5. **Perform Manual QA** exactly as written.  
6. **Emit artifacts**: ensure the executor writes `summary.json` and the checker writes the checker report.  
7. **Open a PR** referencing the phase plan and attach artifact files or links.

---

## Updating a phase plan

- Make changes in a dedicated branch (for example `docs/update-plan-phase-06`).  
- Keep the structure and headings of the phase plan intact.  
- If the change alters contracts or acceptance criteria, **update the matching `/agents` Executor.md and Checker.md**.  
- Add a **“Change Notes”** section at the bottom of the phase plan documenting what changed, why, and when.

Suggested “Change Notes” block:

```
## Change Notes
- 2025-10-25: Clarified /api/v1/dashboard response includes plant_count per village.
- 2025-10-25: Added explicit example for Today checklist item schema.
```

---

## Creating a new phase plan

If you need to add an extra phase, copy this template into `/plan/Phase-XX_New_Phase_Name.md` and replace placeholders:

```
# Phase XX — New Phase Name
## Objective
Concise description of the value delivered by this phase.

## Prerequisites
List earlier phases or tools that must be ready.

## Detailed Work Items
1. Step one
2. Step two
3. Step three

## File Tree Changes
<code block showing exact files to add or modify>

## API/UI Contracts
- Endpoints or routes, including parameter and response examples
- State shapes or event names if relevant

## Tests
- Unit tests and integration tests to add, with focus areas

## Manual QA
- Hands-on steps to validate functionality and UX

## Risks & Mitigations
- Risk: Description
  - Mitigation: Action

## Rollback
Explicit, safe steps to revert changes or reset data

## Definition of Done
- Checklist item one
- Checklist item two
- Checklist item three

## Change Notes
- YYYY-MM-DD: What changed and why
```

Ensure the new phase plan remains compatible with the **Global Guardrails** in `/agents/Global_Guardrails.md`.

---

## Index of phases in this plan set

- Phase 00 — Bootstrap and Dev Ergonomics  
- Phase 01 — Data Model and CRUD  
- Phase 02 — Media Uploads, EXIF, Thumbnails  
- Phase 03 — Search (FTS5) and Tags  
- Phase 04 — Dashboard Aggregates  
- Phase 05 — Frontend Shell and MVVM Plumbing  
- Phase 06 — Home View (Villages)  
- Phase 07 — Village Detail View  
- Phase 08 — Plant Detail (Overview, Care, History, Photos)  
- Phase 09 — Tasks View and Cadence Engine  
- Phase 10 — Offline and PWA Niceties  
- Phase 11 — Export and Import  
- Phase 12 — Visual Polish and Accessibility  
- Phase 13 — Packaging and Deployment

This list mirrors the phase files shipped in the archive. If your repository includes a different set, align this index with your actual `/plan` contents.

---

## Best practices when following the plans

- **Stay local-first:** No dependence on cloud services or external APIs for core features.  
- **Keep MVVM on the frontend only:** The backend uses domain models, services, repositories, and routers.  
- **No ellipses in code:** When adding code files referenced by the plans, include complete source without placeholders.  
- **A11y always on:** Keyboard focus, visible outlines, and contrast targets should be maintained from Phase 05 onward.  
- **Determinism and idempotence:** Scripts, seeds, and migrations should produce stable results every run.  
- **Small commits, clear messages:** Map each commit to a Work Item in the plan for easy review.

---

## FAQ

**Q: Where should summaries and check results live?**  
A: Under `/artifacts/Phase-XX_*`. They are required for the definition of done in each phase.

**Q: What if I need to change an API contract mid-phase?**  
A: Update the plan, the executor prompt, and corresponding tests immediately, and note it in Change Notes. Re-run the checker.

**Q: Does the plan enforce timeline or estimates?**  
A: No timelines are included. The plan defines scope and acceptance only.

---

## Final note

Use `/plan` to decide exactly **what** needs to be built and verified. Use `/agents` to define **how** to execute and check the work. Keep them synchronized and let the artifacts prove the progress.
