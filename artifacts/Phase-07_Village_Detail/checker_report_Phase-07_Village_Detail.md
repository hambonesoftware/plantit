# Phase 07 — Checker Report

**Summary:** PASS (backend tests blocked by missing FastAPI dependency in container)

## Acceptance Criteria Evidence
- **Plant grid/list with filters:** `frontend/js/views/village-view.js` renders grid and list presentations with tag and due filters driven by `VillageVM`.
- **Filters operate without re-fetching:** `VillageVM.setFilter` recalculates in-memory (`frontend/js/viewmodels/VillageVM.js`), verified by unit tests.
- **Quick actions (log water, add photo):** Actions in `village-view.js` call `VillageVM.logWater` and `VillageVM.addPhoto` for optimistic feedback.
- **Move plant between villages:** `VillageVM.movePlant` posts to `/plants/{id}:move` and removes the plant locally on success.
- **Tests cover filters and performance expectations:** `frontend/tests/villageVM.test.js` ensures filtering, movement, and action flows behave as expected.

## Tests
- `npm test` — PASS
- `pytest` — FAIL (FastAPI dependency missing)

## Guardrails
- Stack lock maintained; no external services introduced.
- Accessibility: controls have hidden labels, aria-live containers, keyboard-friendly buttons.
- Local-first and deterministic behavior preserved.

## Routes / Endpoints
| Type | Identifier |
| --- | --- |
| UI Route | `#/v/:id` |
| API | `GET /api/v1/plants?village_id={id}` |
| API | `GET /api/v1/dashboard` |
| API | `POST /api/v1/plants/{id}/logs` |
| API | `POST /api/v1/plants/{id}/photos` |
| API | `POST /api/v1/plants/{id}:move` |

## TODOs / Follow-ups
- Provision backend dependencies locally to run `pytest`.
- Wire quick actions to real backend endpoints when available (logs, photos, move).
