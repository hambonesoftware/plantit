# Agent Phase 14 — Performance Budgets & Code Splitting

## Objective
Performance budgets and code splitting.

## File Operations
- Enforce initial JS < 50KB gz.
- Defer non-critical modules via dynamic import.
- Add `<link rel='preconnect'>` and preload hints for API if helpful.

## Commands to Run
Record local TTI and bundle sizes; commit a perf report.

## Verification / Definition of Done
Budgets pass; reports stored under /artifacts/perf.

## Rollback Plan
Relax budgets with rationale, documented in the repo.

## Notes
Measure before and after each optimization.
