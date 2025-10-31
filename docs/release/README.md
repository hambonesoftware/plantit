# Release and Operations Guide

Plantit ships as a simple Python web stack. This guide captures the repeatable steps to run it locally, cut a release, and roll back safely.

## 60-second Local Boot

1. **Clone and enter the repo**
   ```bash
   git clone <repo-url>
   cd plantit
   ```
2. **Create a virtual environment (Python 3.12+) and install deps**
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
3. **Start the dev orchestrator**
   ```bash
   python run.py
   ```
   - Static SPA: http://127.0.0.1:5580
   - FastAPI backend: http://127.0.0.1:5581 (JSON logs in the terminal)

To run the unified production server instead:
```bash
python serve.py --host 0.0.0.0 --port 5580
```
All assets and APIs are served on a single origin.

## Versioning Source of Truth

- The canonical version string lives in `plantit/VERSION` and is exposed at runtime as `plantit.__version__`.
- `/api/health` reports this value unless the environment variable `PLANTIT_APP_VERSION` overrides it.
- Update the version file and `CHANGELOG.md` together. Commit both changes in the same release PR.

## Cutting a Release

1. Ensure the changelog has a fresh entry for the target version.
2. Update `plantit/VERSION` with the new semantic version.
3. Run the full automated test suite:
   ```bash
   pytest
   ```
4. Optionally set `PLANTIT_BUILD_HASH=$(git rev-parse HEAD)` for traceability in `/api/health`.
5. Commit, push, and create a git tag:
   ```bash
   git commit -am "chore: release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```
6. Publish artifacts (container image, zip, etc.) pointing to the tagged commit.

## Rollback Plan

If a release degrades production:

1. Identify the last known-good tag from `git tag --sort=-creatordate`.
2. Check it out or redeploy using that tag:
   ```bash
   git fetch --tags
   git checkout vW.Z.Y
   python serve.py --host 0.0.0.0 --port 5580
   ```
3. Update deployment tooling to pin `PLANTIT_APP_VERSION` and `PLANTIT_BUILD_HASH` to the restored release so `/api/health` reflects the rollback.
4. Document the incident and reference the rollback in `CHANGELOG.md` if a corrective release follows.

## Related Runbooks

- [First Paint Blocked](../runbooks/first-paint-blocked.md)
- [CORS Fallback](../runbooks/cors-fallback.md)
- [Service Worker Purge](../runbooks/service-worker-purge.md)
