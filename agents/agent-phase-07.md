# Agent Phase 07 — Data Model, SQLite, and Migrations

## Objective
Create DB models, migrations, and seed data.

## File Operations
- Add SQLAlchemy models: Village, Plant, Task.
- Add Alembic migrations (initial tables).
- Add `scripts/seed.py` to populate demo data.
- Expand `/api/health` to include DB check + migration status.

## Commands to Run
Run migrations, seed the DB, hit /api/health.

## Verification / Definition of Done
DB tables exist; seed data appears; health shows db=ok.

## Rollback Plan
Drop DB and re-run migrations from scratch.

## Notes
Keep schema minimal to start; iterate later.
