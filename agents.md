# Agents Orchestrator (agents.md)

This file coordinates the **/agents_v3** prompts for the VM/M backend and V/thin-VM frontend phases **A–N**.

## Folder Layout
```
/agents_v3/
  Global_Guardrails.md
  Phase-A_Repo_Tooling_Hello_VM_M/{Executor.md, Checker.md}
  Phase-B_Models_CRUD/{Executor.md, Checker.md}
  Phase-C_Backend_ViewModels/{Executor.md, Checker.md}
  Phase-D_Frontend_Shell_ThinVMs/{Executor.md, Checker.md}
  Phase-E_UI_CRUD_Flows/{Executor.md, Checker.md}
  Phase-F_Visual_System_Crisp_White/{Executor.md, Checker.md}
  Phase-G_Media_Pipeline_Photos/{Executor.md, Checker.md}
  Phase-H_Search_FTS5_Tags/{Executor.md, Checker.md}
  Phase-I_Dashboard_Aggregates/{Executor.md, Checker.md}
  Phase-J_Tasks_CareProfiles_Optional/{Executor.md, Checker.md}
  Phase-K_Offline_PWA/{Executor.md, Checker.md}
  Phase-L_Export_Import/{Executor.md, Checker.md}
  Phase-M_A11y_Polish_Loading/{Executor.md, Checker.md}
  Phase-N_Packaging_Deployment/{Executor.md, Checker.md}
```

## Golden Rules (always on)
- Read **Global_Guardrails.md** first and keep it open.
- Execute **one phase at a time**.
- **Executor** performs changes. **Checker** verifies guardrails + acceptance.
- Each phase produces artifacts in `/artifacts/<Phase-Dir>/`:
  - `summary.json` (Executor; status + changes + endpoints/routes + notes)
  - `checker_report_<Phase-Dir>.md` (Checker; evidence + PASS/FAIL)
- Frontend is **V/thin-VM only**; backend owns state and VMs.

## Orchestrator Flow
1. Pick a phase (start with **Phase A**).
2. Run the **Executor** prompt for that phase verbatim.
3. Open a PR with all changes and `/artifacts/<Phase>/summary.json`.
4. Independently run the **Checker** prompt. If any critical guardrail is violated, STOP and produce a remediation list.
5. Merge only if the checker report is **PASS** and acceptance criteria are demonstrated.

## Required `summary.json` format
```json
{
  "status": "success",
  "changes": [
    {"path":"backend/api/villages.py","action":"created"},
    {"path":"frontend/js/thinvms/HomeThinVM.js","action":"created"}
  ],
  "api_endpoints": ["GET /api/v1/vm/home","POST /api/v1/villages"],
  "ui_routes": ["#/","#/v/123"],
  "notes": "Implemented CRUD for villages and wired Home VM."
}
```

## Phase Index (A–N)
- A: Repo, Tooling & Health
- B: Models & CRUD (Villages/Plants)
- C: Backend ViewModels (home, villages, village, plant)
- D: Frontend Shell & Thin VMs
- E: UI CRUD Flows
- F: Visual System (crisp white, thin black borders, soft shadows)
- G: Media Pipeline (Photos) + VM extensions
- H: Search (FTS5) & Tags
- I: Dashboard Aggregates
- J: Tasks & Care Profiles (optional)
- K: Offline & PWA queue
- L: Export / Import
- M: Accessibility & Polish (skeletons, reduced motion)
- N: Packaging & Deployment

**Tip:** Keep VM JSON shapes immutable once published; bump version only when necessary.
