# Phase K — Offline & PWA — Checker

## Goal
Validate that the phase meets acceptance criteria and **Global Guardrails**.

## Inputs
- Repo after Executor run.
- `artifacts/Phase-K_Offline_PWA/summary.json`
- Guardrails in `/agents_v3/Global_Guardrails.md`

## Checks
1. **Guardrails**: Backend owns logic; frontend thin VMs only; persistence rules respected.
2. **Diff hygiene**: Only expected files changed; no scope creep.
3. **Tests**: Run test suite and linters.
4. **Behavioral Checks**:
- - Turn off API, perform a write, turn on, verify automatic replay.
5. **ETag & Error**: Spot-check responses for ETag headers and error envelope.
6. **Docs**: README updated if endpoints or commands changed.

## Required Output
Create `artifacts/Phase-K_Offline_PWA/checker_report_Phase-K_Offline_PWA.md` with:
- Summary (PASS/FAIL/PARTIAL)
- Evidence per acceptance criterion
- Guardrail violations + remediation steps
- Endpoints/routes affected
- TODOs and follow-ups

## Stop Conditions
If a critical guardrail is violated, STOP and produce remediation list; do not attempt to fix as the Checker.
