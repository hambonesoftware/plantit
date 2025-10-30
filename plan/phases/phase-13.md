# Phase 13 - Security & CSP & Auth Toggle
**Objective:** Security defaults suitable for local app, with optional auth.

**Deliverables:**
- CSP header set in prod/unified mode (no inline scripts; hashes provided).
- Cookie flags (SameSite/Lax) if auth enabled; CSRF notes for future multi-user.
- Simple auth toggle (env var) gates write paths behind a dummy login form.

**Definition of Done:**
- Security headers verified; app still paints; write paths require login if enabled.
