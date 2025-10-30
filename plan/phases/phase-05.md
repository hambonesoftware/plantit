# Phase 05 - Import/Export Service (Spec & Stubs)
**Objective:** Define import/export behavior and progress events.

**Deliverables:**
- Import: parse JSON bundle, validate schema version, fire progress events.
- Export: assemble current state + metadata, download as JSON with filename pattern `plantit-export-YYYYMMDD.json`.
- Backend placeholder endpoints prepared for later server-side implementation.

**Definition of Done:**
- Import/export buttons are wired to dummy services that resolve in safe mode (no state mutation).
