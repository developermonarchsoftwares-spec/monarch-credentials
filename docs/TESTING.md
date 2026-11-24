# Testing report

Run: `npm test` (Vitest), `npm run typecheck`, `npm run build`.

## Automated (46 tests, all passing at time of writing)
Tests run the real SQL migrations through `node:sqlite` behind a small D1-compatible adapter (`tests/helpers/d1.ts`) and call the real Hono app.
- **Unit** (`tests/unit.test.ts`, 15): ID format/uniqueness (20k draws)/normalisation, password hashing, validation rules, RBAC helpers, all four PDF templates, determinism, unusual/long names, QR matrix.
- **Authentication**: unauthenticated rejection; generic failure messages and audit; cookie flags; token not stored raw; CSRF and cross-origin blocking; logout; login rate limit; deactivation.
- **Issuance**: draft invisible; publish → public; signatory required; immutability; revoke needs a reason, double-revoke rejected, revoked page + PDF 410; PDF served and recorded once; audit trail order; DB-level ID uniqueness.
- **Authorisation**: cross-issuer create/revoke/read blocked and lists scoped; viewer read-only; user/audit routes Super-Admin only; issuer profile edits scoped; last Super Admin protection; user creation hashing.
- **Students**: duplicate email/name protection with explicit override, search, pagination, wildcard escaping, delete protection, markup rejected.
- **Public**: malformed/SQL-injection-style IDs, rate limiting, hashed IPs, masked exact-match name search, security headers, no PII in responses.
- **Dashboard**: real, issuer-scoped counts; safe sort/filter.

## Manual end-to-end (Playwright against `vite dev`: real workerd + local D1)
Sign-in rejection and success, issuer setup, inline student creation, draft → publish → public verification → revoke, PDF download (rendered and visually inspected), dashboard with live data, 390 px mobile layout with no horizontal overflow. Screenshots were reviewed by hand.

## Not tested / not done
- No deployment to Cloudflare was performed (no credentials in this environment); `wrangler deploy` and the custom domain are untested.
- No automated browser tests are committed; the Playwright run was manual.
- No load or PDF-CPU testing on Cloudflare's runtime.
- No accessibility audit beyond semantic markup, focus styles and ARIA labels.
