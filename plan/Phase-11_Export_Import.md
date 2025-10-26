# Phase 11 — Export / Import
## Objective
Human-readable backup/restore of data and media manifest; optional zipped media export.

## Prerequisites
- Phases 01–10 complete.

## Detailed Work Items
1. `GET /api/v1/export?scope=` returns JSON bundle with media manifest.
2. `POST /api/v1/import` upserts entities; remap IDs safely; conflict report.
3. UI in Home sidebar to trigger export/import with scope picker.

## File Tree Changes
```
backend/services/backup.py
backend/api/export.py
frontend/js/views/export-import.js
```

## API Contracts
- `GET /api/v1/export?scope=all|village|plant`
- `POST /api/v1/import`

## Tests
- Round-trip on clean DB; conflict resolution unit tests.

## Manual QA
- Export -> wipe DB -> Import -> verify state restored exactly (photos remapped).

## Definition of Done
- Reliable, repeatable backup and restore.
