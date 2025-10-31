# E2E Test Artifacts

The Playwright-based end-to-end suite requires a Chromium build. Browser downloads are blocked in this execution environment (`playwright install chromium` failed with `ERR_SOCKET_CLOSED`), so the tests were skipped.

To regenerate the real artifacts run:

```bash
playwright install chromium
pytest tests/e2e -s
```

Successful runs will write `first_paint_metrics.json` and supporting screenshots to this directory.
