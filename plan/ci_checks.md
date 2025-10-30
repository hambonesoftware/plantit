# CI Checks

**Required in every PR:**
1. Run `scripts/smoke.sh` (or PowerShell equivalent on Windows).
2. Import-cycle check over `components/`, `views/`, `vm/`, `store.js`.
3. Lint for Perf Guard rules:
   - No top-level await in app modules.
   - No while(true) or long (>200k iter) loops in module scope.
4. Verify that router init is deferred until after first rAF (grep/AST check).
5. Service Worker usage is forbidden unless Phase 5 flag enabled.
