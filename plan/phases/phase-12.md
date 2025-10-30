# Phase 12 - Observability & Error Taxonomy
**Objective:** Full telemetry across client/server with correlation ids.

**Deliverables:**
- Client log helper adds `cid` to each request; server echoes in responses/logs.
- Error taxonomy (UserError, NetworkError, ServerError) mapped to UI panels.
- `/api/health` extended to include app version and build hash.

**Definition of Done:**
- Errors show actionable messages; logs aggregate by correlation id.
