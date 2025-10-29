# Plantit Design Notes

## Design tokens
```
:root {
  --bg: #F7F6F3;
  --panel: #FFFFFF;
  --text: #0F172A;
  --muted: #6B7280;
  --accent: #2E7D32;
  --accent-weak: #E9F5EB;
  --warn: #E57373;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --shadow-sm: 0 1px 2px rgba(16,24,40,.06);
  --shadow-md: 0 8px 24px rgba(16,24,40,.08);
  --gap: 16px;
  --card-w: 360px;
  --ring: 0 0 0 3px rgba(46,125,50,.25);
  --font: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, sans-serif;
}
```

## Core components
- **AppShell:** logo, search, action icons, avatar.
- **Village cards:** highlight due/overdue badges with accent + muted text; 360px min width.
- **Today panel:** right-aligned panel with collapsible list and calendar (`aria-live="polite"`).
- **Mini calendar:** grid of dots using `--accent` for due dates.
- **Import/Export footer:** link-styled buttons with status text (`role="status"`).

## Interaction & accessibility
- Keyboard focus ring uses `--ring` outlines.
- All interactive elements reachable via tab order; modal traps focus.
- Toast/status messaging uses polite live region in footer for import/export feedback.
- CSP locked to `default-src 'self'`; no external fonts.

## Screens
1. **Dashboard:** grid of village cards + Today panel.
2. **Village view:** header with back button, quick add plant form, plant rows.
3. **Plant modal:** schedule editor, watering action, log timeline.
4. **Footer utilities:** Export/Import actions with validation summaries.

## QA references
- Compare layout to mock between 1200–1440px widths (cards align in a responsive grid).
- Verify calendar dots update after completing tasks/watering.
- Confirm import dry-run summary and final success message appear in the footer live region.
