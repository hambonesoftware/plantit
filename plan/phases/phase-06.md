# Phase 06 - OpenAPI Contracts & Fixtures
**Objective:** OpenAPI-first API contracts for read paths with fixtures.

**Deliverables:**
- `backend/openapi.yaml` covering: villages, plants, today summary, import/export hooks.
- FastAPI routes stubbed to return typed fixture JSON aligned to OpenAPI schemas.
- Contract tests to verify JSON conforms to schema.

**Definition of Done:**
- `prance` or `openapi-core` validation passes.
- `curl` to each endpoint returns the documented shape.
