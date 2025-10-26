# Phase 05 — Frontend Foundation (Shell + MVVM)
## Objective
Create the application shell, MVVM plumbing, router, event bus, toast system, and API client with error/ETag handling.

## Prerequisites
- Phase 00 complete; backend available for dev.

## Detailed Work Items
1. Add CSS design tokens (colors, spacing, radius, shadow, typography).
2. Build top bar with logo, global search field, profile bubble.
3. Implement grid layout with main content and right sidebar.
4. Add `router.js`, `state.js` event bus, and `ui/toast.js`.
5. Implement `services/apiClient.js` with fetch wrapper, ETag handling, normalized errors.
6. Accessibility pass for shell (landmarks, focus, aria-labels).

## File Tree Changes
```
frontend/styles/tokens.css
frontend/styles/base.css
frontend/js/main.js
frontend/js/router.js
frontend/js/state.js
frontend/js/services/apiClient.js
frontend/js/ui/toast.js
frontend/js/views/_shell.js
```

## UI Routes
- `/`, `/v/:id`, `/p/:id`, `/tasks`, `/settings` (placeholders).

## Tests
- Router route matching unit tests.
- Event bus subscription/unsubscription tests.

## Manual QA
- Tab through shell; verify focus order and visible outlines.

## Definition of Done
- Shell loads and is accessible; errors surface via toasts.
