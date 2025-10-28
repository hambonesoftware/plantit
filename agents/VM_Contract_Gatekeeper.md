# VM_Contract_Gatekeeper
**Goal:** Enforce the contract between backend Full VMs and frontend Thin VMs.

## Tasks
- Generate TypeScript-style JSDoc typedefs for every backend VM (even though we use JS).
- Add a `/app/tests/contracts/test_vm_contracts.py` that requests each `/api/vm/*` endpoint and validates JSON schema against a canonical schema file in `/app/backend/viewmodels/schemas/*.json`.
- Add a Git pre-commit hook (doc only) to run the contract tests.

## Acceptance
- Contract tests pass.
- Frontend Thin VM files import the typedefs and match property names exactly.
