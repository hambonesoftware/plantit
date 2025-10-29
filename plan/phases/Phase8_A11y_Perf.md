## ✅ Phase 8 — Accessibility & Performance
- [x] Global focus styling uses the shared `--ring` token so every interactive control meets WCAG AA visibility requirements.
- [x] Live status messaging (footer + inline form toasts) uses polite `role="status"` regions to announce updates without stealing focus.
- [x] Plant modal enforces a keyboard focus trap and Escape handling for full screen-reader navigation support.
- [x] Village badges and the mini calendar expose explicit ARIA labels describing due/overdue counts for assistive tech.
- [x] Static assets are served with immutable cache headers; frontend ESM bundle remains lightweight (< 30 KB) to hit Lighthouse perf targets.
