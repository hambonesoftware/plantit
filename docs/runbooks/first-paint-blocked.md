# First Paint Blocked Runbook

Resolve situations where users see a blank screen or "Loading…" indefinitely.

## 1. Capture Diagnostics

- Ask the reporter for the timestamp, browser, and whether the `Safe Mode` banner is visible.
- Collect console logs and the `artifacts/e2e/first_paint_metrics.json` file from the latest CI run if available.

## 2. Verify Static Asset Delivery

- If running `run.py`, ensure the static server on port `5580` is reachable:
  ```bash
  curl -I http://127.0.0.1:5580/app.js
  ```
- If the request fails, restart using the unified server:
  ```bash
  python serve.py --host 0.0.0.0 --port 5580
  ```

## 3. Check Backend Liveness

- The frontend waits for `/api/dashboard`. Verify the API responds quickly:
  ```bash
  curl -w '\n%{time_total}s total\n' http://127.0.0.1:5581/api/dashboard
  ```
- Response times over 2 seconds indicate backend pressure; inspect server logs for slow queries.

## 4. Apply Safe Mode

- Visit the app with `?safe=1` to bypass router/view-model hydration.
- If the page paints correctly, the issue lies in dynamic modules. Collect stack traces and check network requests for pending Promises.

## 5. Communicate Resolution

- Document the root cause (static outage, API latency, module failure).
- Link to relevant commits, traces, or incident reports for future reference.
