# CORS Fallback Runbook

When the SPA cannot reach the API due to CORS errors, follow this playbook.

## 1. Confirm the Symptom

- Open the browser developer tools and check the **Console** and **Network** tabs for `CORS` or `Access-Control-Allow-Origin` errors.
- Note which host/port the browser attempted to reach (e.g. `http://127.0.0.1:5581`).

## 2. Verify Server Mode

- **Dev mode (`run.py`)**: Static assets on port `5580`, API on `5581`.
- **Prod mode (`serve.py`)**: Both served from a single port (default `5580`).
- Ensure the front-end is loading from the same host and port the backend expects.

## 3. Apply a Safe Fallback

1. Stop all Plantit processes.
2. Start the unified server which avoids cross-origin requests:
   ```bash
   python serve.py --host 127.0.0.1 --port 5580
   ```
3. Reload the browser. Requests now target the same origin and bypass CORS.

## 4. Restore Dev Split Ports (Optional)

If you need split ports again:

- Serve the frontend from `http://127.0.0.1:5580` (the value baked into `backend/app.py`).
- If you must use a different host, edit the `allow_origins` list in `backend/app.py` to include it, then restart `run.py`.

## 5. Document the Incident

- Capture logs from `artifacts/e2e/dev-server.log` (if available) and browser console screenshots.
- Record the misconfiguration and corrective steps in your incident tracker.
