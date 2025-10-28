# API_Integrator
**Goal:** Wire apiClient.js to REST endpoints; implement optimistic updates and error toasts.
**Endpoints used:**
- GET `/api/dashboard` → {{ villages:[{{id,name,counts}}], today:[...] }}
- POST `/api/plants` (create)
- POST `/api/tasks/complete/:id`
- GET `/api/villages/:id`

**Acceptance:** UI state always reflects server within 1 request cycle; network errors show toast.
