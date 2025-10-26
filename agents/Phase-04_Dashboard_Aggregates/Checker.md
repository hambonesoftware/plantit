# Dashboard Aggregates — Checker Agent

## Goal
Verify the Dashboard Aggregates work meets acceptance criteria and global guardrails.

## Inputs
- Repo after execution.
- Artifacts: `artifacts/Phase-04_Dashboard_Aggregates/summary.json` (if present).
- Global Guardrails.

## Checks
1. **Guardrails**: Confirm no violations (stack, local-first, a11y baseline, file paths).
2. **File Diff**: List created/modified files; ensure no unrelated churn.
3. **Tests**: Run backend tests (`make test` or `pytest -q`). For frontend phases, run VM/unit tests and linters.
4. **Behavioral Checks**:
- Start dev environment and interact with the new feature manually to confirm behavior
- Check logs for errors/warnings during normal flows
5. **Performance/A11y** (where relevant): Measure rough timings and check focus/ARIA where specified.
6. **Docs**: README updated for new commands/endpoints.

## Required Output
Produce a **`checker_report_Phase-04_Dashboard_Aggregates.md`** with:
- Summary (pass/fail/partial)
- Evidence for each acceptance criterion
- Noted guardrail violations (if any) with remediation steps
- Table of endpoints/routes affected
- TODO list

## Stop Conditions
- If critical guardrail violation is found, STOP and open a remediation task list instead of attempting fixes.
