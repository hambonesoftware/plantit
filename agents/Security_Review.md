# Security_Review
**Checklist**
- CSP: `default-src 'self'`.
- Set `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- Validate JSON imports; size limit 5 MB; filetype check.
- DB path is writable only by app user; backups timestamped.
