# Service Worker Purge Runbook

Use this guide when users report stale assets or offline shells persisting after a deploy.

## 1. Verify the Issue

- Confirm the report includes symptoms such as cached JavaScript, missing styles, or the "Safe Mode" banner disappearing unexpectedly.
- Ask the user to open DevTools → Application → Service Workers and capture a screenshot.

## 2. Purge Existing Workers

1. Instruct the user to visit Plantit with the query flag `?no-sw=1` (e.g. `http://127.0.0.1:5580/?no-sw=1`).
2. The app automatically unregisters all workers when `no-sw=1` is present.
3. Ask the user to perform a hard refresh (Ctrl+Shift+R / Cmd+Shift+R).

## 3. Confirm Clean State

- In DevTools, ensure no workers are registered for the site.
- Clear `IndexedDB` and `Local Storage` entries prefixed with `plantit:` if they exist.

## 4. Prevent Recurrence

- Deploy using `python serve.py` so static assets and API originate from the same host.
- Document the deployment timestamp and package hash (`PLANTIT_BUILD_HASH`) for traceability.
