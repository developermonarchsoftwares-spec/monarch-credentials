# Monarch Credentials

Certificate issuance and public verification for **Monarch Placements** (training, competency, placement readiness) and **Monarch Softwares** (internships, project internships). Serverless on Cloudflare: one Worker serves the API and the React app, D1 stores the data. No VPS.

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React 19 + TypeScript, Tailwind v4, shadcn-style primitives (Radix, CVA), Lucide | Pure SPA served as Worker static assets. Avoids Next.js/OpenNext compatibility risk and keeps cookies same-origin. |
| Backend | Hono on Cloudflare Workers (`src/worker`) | Small, typed, Workers-native. |
| Database | Cloudflare D1 (`migrations/`) | Relational, free tier, atomic `batch()` writes. |
| PDF | `pdf-lib` (pure JS, runs in Workers), generated on demand | No R2 needed. A `certificate_files` row records each distinct rendering (hash, size). |
| QR | `uqr` (pure JS, no dependencies) | Encodes only the verification URL. |
| Validation | Zod | Server-side on every write. |
| Auth | PBKDF2-SHA256 (100k iterations, the Workers maximum), server-side sessions in D1, HttpOnly/Secure/SameSite=Strict cookie, per-session CSRF token | No third-party services. |

```
src/worker/   API: routes/ (public, auth, admin-*), lib/ (crypto, ids, rbac, pdf, qr, session, db, validation)
src/web/      React app: pages/ (public), pages/admin/, components/, lib/
src/shared/   Types shared by both
migrations/   D1 schema + reference data (issuers, roles, certificate types only)
scripts/      create-admin.mjs (bootstrap the first Super Admin)
tests/        Vitest: unit + API tests against real SQL (node:sqlite) and the real migrations
docs/         DEPLOYMENT, SECURITY, TESTING, COSTS
```

## Local development

Requires Node 20+. Works on Windows, macOS and Linux.

```bash
npm install
npm run setup          # creates .dev.vars, migrates the local DB, asks for your admin email/name/password
npm run dev            # http://localhost:5173 (real workerd + local D1)
```

For a throwaway local account instead of prompts: `npm run setup:defaults` (admin@example.com / local-dev-password-123).
Re-running setup is safe; running it with the same email resets that admin's password.
Tests: `npm test`, `npm run typecheck`.

Sign in at `/admin/login`. Before the first publish, open **Issuers** and set each issuer's authorised signatory (name and designation). Publishing is blocked until then, because the signatory is printed on every PDF.

## Credential lifecycle

`draft` → `valid` → `revoked`. Drafts are invisible publicly and editable. Published credentials are immutable (revoke instead). Revoked credentials show **Revoked** publicly and cannot be downloaded. IDs look like `MPS-2026-K7Q4M9XB` (`MPS` training, `MPC` competency, `MPR` placement readiness, `MSI` internship, `MPI` project internship) and use 8 Crockford-base32 characters from `crypto.getRandomValues` (about 1.1 × 10¹² per prefix and year) with a DB `UNIQUE` constraint and retry on collision.

## Roles

| Role | Read | Write |
|---|---|---|
| Super Admin | everything | everything, plus users and audit log |
| Placements Admin | Placements credentials | Placements credentials, Placements issuer profile, students |
| Softwares Admin | Softwares credentials | Softwares credentials, Softwares issuer profile, students |
| Viewer | all credentials | nothing |

## Known limitations (read these)

- **Names on PDFs**: the built-in PDF fonts support Latin characters only. Diacritics are folded (José → Jose); other scripts are not supported. Student names are restricted to letters, spaces, `.`, `'` and `-`.
- **Issuer logos** are the real Monarch Placements and Monarch Softwares marks: `public/logos/*.svg` for the web, and `src/worker/lib/logo-*.ts` (base64 PNG) for the certificate PDF. They are raster; replace with vector originals when available.
- **Contact details** for the issuers are intentionally empty until entered in the admin UI. Nothing has been invented.
- **Name search** is exact-match, masked, per-issuer and tightly rate limited, but anyone who knows a learner's full name can find that learner's credential. Disable it by removing the `POST /api/public/search` route if that is unacceptable.
- **LinkedIn**: the "Add to profile" link only pre-fills LinkedIn's form. LinkedIn does not verify the credential; the page says so.
- Rate limiting uses D1 counters (fixed window). It is adequate for this scale; for abuse at scale add Cloudflare WAF rate-limiting rules.
- The legal pages are plain-language drafts and must be reviewed by counsel.
