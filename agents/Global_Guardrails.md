# Global Guardrails — Plantit (VM/M backend, V/thin-VM frontend)

Date: 2025-10-27

## Architectural Hard Rules
1. **Ownership of logic**: Backend (FastAPI) owns **Models** and **ViewModels** (VM/M). Frontend has **Views + thin ViewModels** only. No business logic in the browser.
2. **Persistence**: SQLite via SQLModel; DB at `./backend/data/plantit.db`. All Villages and Plants must be persisted. Enforce FKs and timestamps.
3. **CRUD coverage**: Villages and Plants have full CRUD (GET list/detail, POST, PATCH, DELETE). IDs are UUIDs. Responses include stable IDs and ETags.
4. **VM Endpoints**: `/api/v1/vm/home`, `/api/v1/vm/villages`, `/api/v1/vm/village/{id}`, `/api/v1/vm/plant/{id}` return view-ready JSON. Shapes are **stable** once published.
5. **Thin VM Rule**: Frontend thin VMs read via `/vm/*` and **write via CRUD**, then **re-fetch** the relevant VM endpoint to re-sync state.
6. **Local-first**: No cloud dependencies. Media stored under `./backend/data/media/{yyyy}/{mm}/{uuid}.ext` with `thumb_{uuid}.jpg` thumbnails.
7. **Design language**: Crisp **white** surfaces, **thin black borders**, **soft shadows**, rounded corners. Consistent tokens in `frontend/styles/tokens.css`.
8. **Accessibility**: Visible focus outlines, keyboard operable controls, color contrast ≥ 4.5:1, `prefers-reduced-motion` respected.
9. **Error model**: JSON envelope
   ```json
   {"error": {"code": "VALIDATION_ERROR", "message": "...", "field": "..."}}
   ```
10. **ETags & caching**: All GET list/detail (CRUD and VM) return `ETag`. Clients send `If-None-Match`.
11. **Testing**: Backend pytest for CRUD + VM shapes; frontend thin-VM tests for load/mutate-reload; basic view smoke tests.
12. **No ellipses in code**: Do not elide implementation with `...`.
13. **Idempotence**: Seeds, migrations, and scripts are safe to re-run. If partial work is delivered, mark artifacts accordingly.
