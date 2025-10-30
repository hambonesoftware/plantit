# Agent Phase 13 — Security & CSP & Auth Toggle

## Objective
Security headers & optional auth toggle.

## File Operations
- Prod/unified mode sets strict CSP; no inline scripts; add script hashes.
- Add env-driven auth toggle; wrap write paths behind a basic login screen.
- If auth enabled, send SameSite=Lax cookies and CSRF notes for future multi-user.

## Commands to Run
Run in prod mode; verify CSP and that write paths require login when enabled.

## Verification / Definition of Done
Security headers present; app still paints; auth toggle effective.

## Rollback Plan
Disable CSP and auth toggle for local dev to isolate issues.

## Notes
Document any third-party origins in CSP.
