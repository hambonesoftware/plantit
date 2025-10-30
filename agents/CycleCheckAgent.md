# CycleCheckAgent

**Objective**
Block import cycles that can wedge ESM evaluation.

**You Will:**
- Run an import graph tool (esbuild/rollup plugin or a small custom script).
- Scope: `components/`, `views/`, `vm/`, `store.js`.
- Fail CI if any cycle is detected.

**Acceptance Criteria**
- Zero import cycles reported.
