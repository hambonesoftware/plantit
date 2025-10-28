# Plantit (Self‑Hosted) — Project Plan Orchestrator
**Stack (locked):** HTML/CSS/ESM‑JS frontend (no npm/CDN), Python 3.12 + FastAPI backend.  
**Run command:** `python run.py` at repo root.  
**Data:** SQLite (file), Pydantic models, SQLAlchemy ORM.  
**Libraries:** All vendored locally. No external network/CDN at runtime.  
**Design:** Match the provided mock exactly: soft off‑white canvas, rounded cards, subtle shadows, green accent badges, right‑hand “Today” panel, mini calendar, Export/Import footer actions.

## Folder Standard
```
/app
  /backend            # FastAPI + SQLAlchemy
    /routers
    /models
    /schemas
    /services
    /seed
  /frontend           # static HTML/CSS/ESM modules
    /static
      /css
      /js
      /img
      /vendor         # vendored JS helper libs if any (prefer none)
      /fonts          # local font files or use system fonts
    index.html
  /tests              # pytest tests (backend) + smoke tests for frontend with pytest-playwright
/tools
  offline_install.py  # installs from vendor wheels only
  fetch_wheels.py     # prefetches wheels into vendor/wheels
/vendor
  /wheels             # pre-downloaded pip wheels for offline install
run.py                # single entry point
requirements.txt
.env.example
README.md
```

## Design Tokens (must be implemented in CSS variables)
```
:root {
  --bg: #F7F6F3;
  --panel: #FFFFFF;
  --text: #0F172A;
  --muted: #6B7280;
  --accent: #2E7D32;
  --accent-weak: #E9F5EB;
  --warn: #E57373;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,.06);
  --shadow-md: 0 8px 24px rgba(16,24,40,.08);
  --gap: 16px;
  --card-w: 360px;
  --ring: 0 0 0 3px rgba(46,125,50,.25);
  --font: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif;
}
```

## Phases (each must end with a running app using `python run.py`)

### Phase 0 — Repo Scaffold & Offline Prep
- Create folder tree above.
- `run.py` starts FastAPI+Uvicorn and serves `/app/frontend` statics at `/`.
- Add `requirements.txt` (fastapi, uvicorn[standard], pydantic, sqlalchemy, aiosqlite, python-dotenv, jinja2, httpx, pytest, pytest-playwright).
- `tools/fetch_wheels.py` downloads **all** wheels to `/vendor/wheels`.
- `tools/offline_install.py` installs from `/vendor/wheels` only.
**Acceptance:**
- Fresh machine can `python tools/fetch_wheels.py` (one-time online), then disconnect and `python tools/offline_install.py`, then `python run.py` opens a placeholder page from local static files.

### Phase 1 — UI Shell & Theme
- Build `index.html`, `static/css/theme.css`, `static/js/app.js` with ESM modules and no frameworks.
- Components: AppShell (logo, search, icons, avatar), Grid of Village Cards, Right “Today” panel, Mini Calendar, Export/Import footer buttons.
- Use **only** the tokens above; ensure rounded corners, mellow shadows, spacing, typography match the mock.
**Acceptance:**
- Visual match within 2px spacing; color hexes/tokens match; keyboard focus outlines visible; responsive to 1200–1440px widths.

### Phase 2 — Backend Models & DB
- Entities:
  - Village(id, name, note, created_at)
  - Plant(id, village_id, name, species, last_watered_at, frequency_days, photo_path)
  - Task(id, plant_id, kind['water','fertilize','repot'], due_date, done_at)
  - Log(id, plant_id, ts, kind, note)
- Create Alembic-free bootstrap (simple `models.py` + `create_db.py`).
- Routers: `/api/villages`, `/api/plants`, `/api/tasks`, `/api/logs`, CRUD + filtered queries (due today, overdue).
**Acceptance:**
- `pytest` covers schema roundtrips; DB file created; CRUD works offline.

### Phase 3 — API Client & State
- `static/js/apiClient.js` (fetch wrapper) and `static/js/store.js` (state with cache & localStorage for user prefs).
- Implement Dashboard query: villages with counts; today tasks; overdue indicators.
**Acceptance:**
- Dashboard cards show counts/badges identical to mock; “Open” and “Quick add plant” actions work.

### Phase 4 — Village & Plant Views
- Village page: list plants, last watered chip, quick actions.
- Plant drawer/modal: edit schedule; log watering; update next due.
**Acceptance:**
- Water action updates UI immediately (optimistic) and persists.

### Phase 5 — Calendar & Today Panel
- Implement JS mini calendar (no external lib) with due dots; right panel lists due/overdue tasks and allows complete.
**Acceptance:**
- Completing in “Today” panel updates calendar and badges within 100ms.

### Phase 6 — Import/Export
- JSON import/export endpoints; file download via `<a download>`; import validation report.
**Acceptance:**
- Export produces a single JSON with villages/plants/tasks/logs; Import merges by id or creates new, with dry-run preview.

### Phase 7 — Packaging & Offline Guarantee
- Add `tools/smoke.py` to open `/health` and verify static checksum list.
- Document “air‑gapped install”: 1) run `fetch_wheels.py` once on a connected box, 2) move repo, 3) run `offline_install.py`, 4) `python run.py`.
- Ensure **no** external network requests (fonts, images, analytics). CSP header set to `default-src 'self'`.
**Acceptance:**
- Smoke test passes; browser devtools shows **zero** blocked/remote requests.

### Phase 8 — Accessibility & Perf
- WCAG AA contrast, focus traps, tab order; ARIA labels for badges & calendar.
- Perf: static cache headers, minimal JS (under 50KB gz), images lazy-loaded.
**Acceptance:**
- Lighthouse A11y ≥ 95, Perf ≥ 90 (run locally).

### Phase 9 — Ops & Docs
- `README.md` quickstart; `OPERATIONS.md` backup/restore; `DESIGN.md` tokens/components.
- Optional services: Windows service (nssm) / systemd unit examples (document only).
**Acceptance:**
- Another engineer can install offline and reproduce the mock in <30 minutes.

## Hard Rules
- **No CDN** assets. Vendor or implement minimal vanilla modules.
- Fonts: use system stack or include local OTF/WOFF files in `/static/fonts`.
- JS only as ESM modules; one global `window.App` namespace for debugging is allowed.
- All UI must be keyboard accessible.


## View-Model Architecture (Locked)
**Goal:** Frontend has *Views* and *Thin VMs* only. Backend owns the *Full VMs* (composition & business rules) and the domain *Models*.

### Backend
```
/app/backend
  /models                # SQLAlchemy domain entities (Village, Plant, Task, Log)
  /viewmodels            # Pydantic VMs composed for screens
    dashboard.py         # DashboardVM, VillageCardVM, TaskVM, CalendarVM
    village.py           # VillageVM (plants[], counts, meta)
    plant.py             # PlantVM (details, schedule, logs)
    today.py             # TodayVM (due/overdue lists)
  /services              # Query + assembly into VMs (pure Python, no FastAPI)
  /routers               # REST + VM endpoints
    vm.py                # GET /api/vm/dashboard, /api/vm/village/{id}, /api/vm/plant/{id}, /api/vm/today
    crud.py              # /api/villages, /api/plants, /api/tasks, /api/logs
```
**Rules:**
- All cross-table joins and derived fields happen in `/services` and return **VMs**.
- VMs use **Pydantic**; their JSON is the contract the frontend consumes.
- CRUD routes mutate domain **models**, then re-fetch/rebuild the affected **VM** and return it.

### Frontend
```
/app/frontend/static/js
  /views                 # Renderers only (DOM logic, events)
    DashboardView.js
    VillageView.js
    PlantView.js
  /vm                    # Thin VM adapters (1:1 to backend VM JSON)
    dashboard.vm.js      # fetch('/api/vm/dashboard') → DashboardVM JSON (no business logic)
    village.vm.js
    plant.vm.js
    today.vm.js
  apiClient.js           # fetch wrapper
  store.js               # UI prefs only (e.g., sidebar state), no domain state
  components/            # AppShell, VillageCard, Badge, Calendar, Toast
```
**Rules:**
- Thin VMs may *format* for display (e.g., relative date strings) but must not compute business logic or joins.
- Property names in Thin VMs **mirror** backend VMs exactly.
- Views import only their matching Thin VM and components.

### VM Endpoints (examples)
- `GET /api/vm/dashboard` → `DashboardVM`
- `GET /api/vm/village/{id}` → `VillageVM`
- `GET /api/vm/plant/{id}` → `PlantVM`
- `GET /api/vm/today` → `TodayVM`
- Mutations return updated VMs whenever feasible:
  - `POST /api/tasks/{id}/complete` → returns `TodayVM` + changed `VillageCardVM`

### Example Pydantic Signatures
```py
# app/backend/viewmodels/common.py
from pydantic import BaseModel
from datetime import date, datetime
from typing import List, Optional

class TaskVM(BaseModel):
    id: int
    plant_id: int
    kind: str           # 'water' | 'fertilize' | 'repot'
    due_date: date
    overdue_days: int
    plant_name: str
    village_name: str

class VillageCardVM(BaseModel):
    id: int
    name: str
    due_today: int
    overdue: int
    last_watered_human: str
```

```py
# app/backend/viewmodels/dashboard.py
from pydantic import BaseModel
from typing import List
from .common import VillageCardVM, TaskVM

class CalendarDot(BaseModel):
    day: int
    count: int

class CalendarVM(BaseModel):
    year: int
    month: int
    dots: List[CalendarDot]

class DashboardVM(BaseModel):
    villages: List[VillageCardVM]
    today: List[TaskVM]
    calendar: CalendarVM
```

### Example Thin VM Adapter (ESM)
```js
// app/frontend/static/js/vm/dashboard.vm.js
import {api} from '../apiClient.js';

/** @typedef {{id:number,name:string,due_today:number,overdue:number,last_watered_human:string}} VillageCardVM */
/** @typedef {{villages:VillageCardVM[], today:any[], calendar:{year:number,month:number,dots:{day:number,count:number}[]}}} DashboardVM */

export async function loadDashboardVM() {
  const res = await api.get('/api/vm/dashboard');
  // Only presentation formatting is allowed here (e.g., none by default)
  return /** @type {DashboardVM} */ (res);
}
```

### Acceptance (Architecture)
- **No** domain logic in `views/` or `vm/` other than presentation formatting.
- Changing a VM field name server-side causes a single compile-time failure in Thin VM typedefs.
- Perf: `GET /api/vm/dashboard` under 50ms on seed DB; dashboard first contentful render < 1s on a modern laptop.
