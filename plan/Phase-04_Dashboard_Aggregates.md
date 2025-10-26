# Phase 04 — Dashboard Aggregates
## Objective
Deliver aggregated data for the homepage cards and sidebar.

## Prerequisites
- Phases 00–03 complete.

## Detailed Work Items
1. Compute per-village: plant_count, due_today, overdue, last_watered_days, cover_photo.
2. Compute Today list with task context (plant, village).
3. Compute mini-calendar: counts per day for next 6 weeks.
4. Expose `GET /api/v1/dashboard` endpoint.

## File Tree Changes
```
backend/services/dashboard.py
backend/api/dashboard.py
backend/tests/test_dashboard.py
```

## API Contract
- `GET /api/v1/dashboard` → object with `villages`, `today`, `calendar` arrays.

## Tests
- Aggregate correctness on edge cases.

## Manual QA
- Compare dashboard output to manual SQL queries for a seed DB.

## Definition of Done
- Endpoint serves everything needed by Home without extra queries.
