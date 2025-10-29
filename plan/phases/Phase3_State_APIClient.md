## ✅ Phase 3 — API Client & State

- [x] `static/js/apiClient.js` wraps `fetch` with JSON handling, automatic retries, and abort-based timeouts so requests recover cleanly from slow networks.
- [x] `static/js/store.js` exposes a shared event emitter, caches dashboard/village/plant data, and persists UI preferences (e.g., collapsed Today panel, last view) to `localStorage`.
- [x] Dashboard loaders (`vm/dashboard.vm.js`) hydrate the store and share cached responses across views, keeping badges and task counts in sync.
