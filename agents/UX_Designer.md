# UX_Designer
**Goal:** Lock the UI spec to match the provided Plantit mock.

## Deliverables
- `/app/frontend/index.html` structure and regions.
- `/app/frontend/static/css/theme.css` defining the tokens below.
- Component spec docs in `/app/frontend/static/docs/components.md`.

## Components
- AppShell: top bar with logo (leaf icon), search input, bell, settings gear, avatar.
- CardGrid: 3-up responsive cards (min width 340–360px).
- VillageCard: image (16:9), title, chip row (Due today + count chip), last-watered text, actions row (Open | Quick add plant).
- TodayPanel: right column with checklist of tasks and a mini-calendar.
- Buttons: neutral and accent variants; rounded 2xl; soft shadow on hover.
- Badges: green (`--accent` on `--accent-weak`) and warning (desaturated red on light red).
- Calendar: inline month grid with tiny dots per task.

## Tokens (do not change values)
- Use the `:root` variables from the Plan.
- Font: system stack only (no webfont calls).

## Layout Rules
- Canvas bg `var(--bg)`; panels `var(--panel)` with `var(--shadow-md)` and `var(--radius-2xl)`.
- Spacing grid is 8pt multiples; use `var(--gap)` as base.
- All clickable elements receive `box-shadow: var(--ring)` on focus-visible.

## Acceptance
- Side-by-side comparison with the mock shows near-identical spacing/typography.
- Keyboard nav hits every control in logical order.
