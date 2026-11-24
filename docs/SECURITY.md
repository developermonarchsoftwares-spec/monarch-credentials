# Security checklist

Status is based on code and automated tests in this repository (see `tests/api.test.ts`). "Manual" items need action at deploy time.

## Implemented and tested
- [x] Passwords hashed with PBKDF2-SHA256, 100,000 iterations (Workers maximum), 16-byte random salt, constant-time comparison; minimum 12 characters.
- [x] Login resists user enumeration (identical message, dummy hash on unknown email) and is rate limited per IP and per email; failures are audit-logged.
- [x] Sessions: 256-bit random token, only its SHA-256 stored; cookie `HttpOnly; Secure; SameSite=Strict`; 8-hour expiry; role/password change and deactivation destroy sessions.
- [x] CSRF: per-session token required in `X-CSRF-Token` on every non-GET admin request, plus same-origin check on `Origin`.
- [x] RBAC enforced server-side on every admin route and every query is issuer-scoped. Cross-issuer reads return 404 and writes 403. Viewers are read-only.
- [x] No public write endpoints. Public routes are read-only and expose only authentication data. Drafts are never public.
- [x] All SQL uses bound parameters. Sort columns come from a fixed allow-list. `LIKE` wildcards are escaped.
- [x] Zod validation on all inputs; names reject markup characters; dates are calendar-validated.
- [x] Certificate IDs: CSPRNG, unique constraint, strict format validation before any lookup.
- [x] Published credentials are immutable; revoke/publish use conditional updates and batch-atomic audit writes (no audit entry if the state change did not happen).
- [x] Public rate limits: 60 lookups/min, 20 PDFs/min, 10 name searches/min per hashed IP. IPs are stored only as salted hashes.
- [x] Audit log for sign-ins, student/certificate/issuer/user changes. It never stores passwords or hashes.
- [x] Security headers (CSP without `unsafe-eval`/inline scripts, HSTS, `frame-ancestors 'none'`, nosniff, referrer policy) on API responses and, via `public/_headers`, on static assets. Credential responses use `Cache-Control: no-store`.
- [x] Errors are generic to clients; details go to server logs only.
- [x] Last active Super Admin cannot be demoted or disabled; users cannot disable themselves.
- [x] `npm audit --omit=dev`: 0 known vulnerabilities at build time.

## Manual / deploy-time
- [ ] Set `IP_HASH_SALT` as a secret; never commit `.dev.vars`.
- [ ] Use a unique passphrase for the first Super Admin; consider also enabling Cloudflare Access (free for small teams) in front of `/admin*` for MFA.
- [ ] Add a Cloudflare WAF rate-limiting rule on `/api/auth/login` and `/api/public/*` for defence in depth.
- [ ] Enable SSL "Full (strict)" and HSTS preload only once you are sure all subdomains are HTTPS.
- [ ] Schedule D1 exports.
- [ ] Legal review of privacy notice and terms.

## Known residual risks
- PBKDF2 at 100k iterations is weaker than Argon2/scrypt; Workers does not offer them natively with acceptable CPU. Long passphrases and Cloudflare Access mitigate this.
- No built-in MFA or password-reset email (no email service was introduced, to stay free).
- Name search allows discovery of a learner's credential by anyone who knows their exact full name.
- Admin PDF preview works for drafts and revoked credentials; admins could share such a file. The public QR on a draft preview resolves to "not found".
