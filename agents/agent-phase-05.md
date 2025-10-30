# Agent Phase 05 — Import/Export Service (Spec & Stubs)

## Objective
Stub Import/Export services with progress events.

## File Operations
- `frontend/services/importExport.js`: `importBundleFromFile(file, onProgress)` and `downloadExportBundle(statusEl)`
- Progress events: 'validating', 'parsing', 'complete'
- Backend placeholders (no-op endpoints) for future server-side import/export

## Commands to Run
Manual test via UI buttons (no state mutation).

## Verification / Definition of Done
Buttons trigger progress logs; export downloads a small JSON stub.

## Rollback Plan
Disable buttons if needed; keep service signatures.

## Notes
User feedback is critical—emit status text updates.
