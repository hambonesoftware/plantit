# Data_Modeler
**Goal:** Define normalized schema and indices.

## Tables
- villages(id PK, name TEXT, note TEXT, created_at DATETIME)
- plants(id PK, village_id FK, name, species, last_watered_at DATETIME, frequency_days INT, photo_path TEXT)
- tasks(id PK, plant_id FK, kind TEXT CHECK(kind in ('water','fertilize','repot')), due_date DATE, done_at DATETIME)
- logs(id PK, plant_id FK, ts DATETIME, kind TEXT, note TEXT)

## Indices
- tasks(due_date), tasks(done_at), plants(village_id)

## Derived
- `next_due = last_watered_at + frequency_days`; store in query, not column.
