# Phase 12 — Visual Polish & Accessibility
## Objective
Finalize look-and-feel to match the preview; a11y scoring and skeleton loaders.

## Prerequisites
- UI phases complete (05–11).

## Detailed Work Items
1. Harmonize design tokens; verify chip colors/contrast.
2. Add skeleton loaders for Home and Village.
3. Respect `prefers-reduced-motion`; provide focus-visible styles.
4. Lighthouse a11y assessment; fix issues.

## File Tree Changes
```
frontend/styles/tokens.css
frontend/styles/base.css
frontend/js/ui/skeleton.js
```

## Tests
- Snapshot tests for key components; a11y checks with axe (optional).

## Manual QA
- Keyboard-only navigation; screen reader spot checks.

## Definition of Done
- A11y score >= 95; polish matches preview.
