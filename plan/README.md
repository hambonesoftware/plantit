# Plantit — Plan v3 (Backend VM/M, Frontend V/thin-VM)
Date: 2025-10-27

This plan set supersedes previous versions. It merges the original instructions with your updated architecture:
- **Backend**: Python FastAPI with **Models + ViewModels (VM/M)**; SQLite via SQLModel.
- **Frontend**: HTML/CSS/ESM-JS with **Views + thin ViewModels** that fetch backend VMs and forward CRUD writes.
- **Persistence**: All Villages and Plants are stored with full CRUD.
- **Design**: Crisp white UI, thin black borders, soft shadows.

## API Namespacing
- CRUD base: `/api/v1` (e.g., `/api/v1/villages`, `/api/v1/plants`).
- ViewModels base: `/api/v1/vm` (e.g., `/api/v1/vm/home`, `/api/v1/vm/village/{id}`, `/api/v1/vm/plant/{id}`).
- All GET list/detail endpoints return `ETag`; clients send `If-None-Match`.

## Storage Layout
- Database file: `backend/data/plantit.db` (SQLite).
- Media: `backend/data/media/{yyyy}/{mm}/{uuid}.ext` and `thumb_{uuid}.jpg`.

## Visual System Tokens (excerpt)
```
:root{
  --bg:#ffffff; --fg:#111111; --muted:#6b7280; --border:#111111;
  --radius:14px; --shadow:0 8px 24px rgba(0,0,0,0.08);
  --gap:16px; --card-pad:16px;
}
.card{background:var(--bg);color:var(--fg);border:1px solid var(--border);
      border-radius:var(--radius);box-shadow:var(--shadow);padding:var(--card-pad);}
```

## Phase Files
This folder contains one Markdown file per phase (A–N). Each file includes Objective, Prerequisites, Detailed Work Items, File Tree Changes, API/UI Contracts, Tests, Manual QA, Risks & Mitigations, Rollback, and a strict Definition of Done.
