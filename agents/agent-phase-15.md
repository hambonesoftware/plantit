# Agent Phase 15 — E2E & Load Tests

## Objective
E2E tests, load tests, packaging, and runbooks.

## File Operations
- Playwright tests for first paint, deep link, and CRUD.
- Locust/k6 script for read endpoints.
- `serve.py` for prod unified port; `run.py` for dev.
- Runbooks: CORS fallback steps, SW purge, 'first paint blocked' playbook.

## Commands to Run
Run E2E and load suites; package build; verify new machine setup works.

## Verification / Definition of Done
All tests green; operator can bring up the app in ~60 seconds.

## Rollback Plan
Revert to dev-only run until tests are stabilized.

## Notes
Keep runbooks concise and actionable.
