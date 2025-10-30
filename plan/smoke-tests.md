# Smoke Tests (Dev)

## First Paint (safe boot)
1. Open `http://127.0.0.1:5580/?safe=1`.
2. Expect visible header and console logs: "Boot: pre-init", "Boot: DOM ready", "Boot: shell mounted".

## Health Endpoints
- `curl -s http://127.0.0.1:5581/api/health`
- `curl -s http://127.0.0.1:5581/api/hello`

## Deep Route Fallback
- `http://127.0.0.1:5580/#/villages/3` should render the shell even on reload.

## No Service Worker
- Visit `http://127.0.0.1:5580/?no-sw=1` to force-disable and unregister any SW.
