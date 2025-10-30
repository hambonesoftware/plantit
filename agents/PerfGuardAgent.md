# PerfGuardAgent

**Objective**
Prevent long main-thread stalls before paint.

**You Will:**
- Enforce lint rules:
  - No top-level `await` in app modules.
  - No `while(true)` or big loops at module scope.
  - LocalStorage reads deferred to `setTimeout(0)` or after first rAF.
- Verify API/network calls begin only after paint.

**Acceptance Criteria**
- Lint passes.
- Manual inspection shows paint precedes any heavy work.
