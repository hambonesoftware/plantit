# Global Guardrails for Plantit

Date: 2025-10-25

## Non-Negotiables
1. **Stack Lock**: Backend = Python 3.12 + FastAPI + SQLModel (SQLite). Frontend = HTML/CSS/ESM-JS with native modules and optional Vite dev server. No React/Angular/Next. No DB other than SQLite for local-first.
2. **Local-First**: Operate without internet. Do not add third-party cloud calls. All assets served locally.
3. **No Kill Switch**: Do not add a global network toggle. Offline behavior is achieved via caching and a request queue.
4. **Security**: Never commit secrets. Validate all file paths and uploads. Enforce content-type and size limits.
5. **Idempotence**: Migrations, seeds, and scheduling must be idempotent. Re-running must not corrupt data.
6. **Accessibility**: Keyboard navigable. Respect prefers-reduced-motion. Maintain color contrast >= 4.5:1 where applicable.
7. **Performance Targets**: Local API < 100ms typical, < 300ms worst-case; Home render < 300ms after dashboard fetch; 60fps scroll on plant grids.
8. **Testing Level**: Each phase ships with tests (pytest for backend, minimal DOM/VM unit tests for frontend when applicable). CI gates: lint + format + tests must pass.
9. **File Paths**: Persist DB at ./data/plantit.db; media under ./data/media/{yyyy}/{mm}/{uuid}. Thumbnails named thumb_{uuid}.jpg.
10. **No Ellipses**: Do not elide code with “...”. Provide complete implementations and file contents.
11. **Time-boxing**: If execution window is short, complete the highest-priority subset and emit partial artifacts with a clear TODO list. Never leave the repo in a broken state.
