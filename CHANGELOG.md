# Changelog

All notable changes to Plantit are documented in this file.

## [0.2.0] - 2026-10-17
### Added
- Local-only IndexedDB persistence for villages, plants, photos, activity, and watering history.
- Offline app-shell caching, install manifest/icons, persistent-storage request, and backup reminders.
- Complete validated backup/restore with atomic replacement and confirmation.
- Markdown imports into the same collection and one-time legacy browser-store migration.
- Static deployment builder, security header templates, read-only SQLite migration exporter, and hosting/recovery guide.
- Automated local data and Chromium browser tests; no backend needed for the PWA.
### Changed
- Frontend requests now execute locally; no login or server data API is used.
- Remote photo links are rejected to prevent third-party image requests.
- The backend remains legacy-only and is excluded from the recommended deployment.

## [0.1.0] - 2025-10-31
### Added
- Development orchestrator (`python run.py`) that serves the SPA and FastAPI API with JSON logs.
- Production entry point (`python serve.py`) combining static assets and API on a single port.
- Operational runbooks covering blocked first paint, CORS fallback, and service-worker cache purges.
- Project version metadata exposed via `plantit.__version__` and surfaced in `/api/health`.
### Changed
- Backend health response now reads the packaged version string when `PLANTIT_APP_VERSION` is unset.
### Notes
- Tag this release with `git tag v0.1.0` after cutting artifacts and update the build hash env var if publishing binaries.
