# Changelog

All notable changes to Plantit are documented in this file.

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
