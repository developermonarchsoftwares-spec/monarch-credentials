# Deployment

Everything below uses Cloudflare's free plan. **Limits and DNS behaviour in this document were not re-verified against live Cloudflare documentation** (the build environment could not reach developers.cloudflare.com). Check the pages linked in `COSTS.md` before go-live.

## 1. Prerequisites
- A Cloudflare account, `npm install`, then `npx wrangler login`.
- The code in GitHub (this repository).

## 2. Create the database
```bash
npx wrangler d1 create monarch-credentials
```
Copy the printed `database_id` into `wrangler.jsonc` (`d1_databases[0].database_id`) and commit.

## 3. Apply migrations and create the first admin
```bash
npm run db:migrate:remote
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='long unique passphrase' npm run admin:create -- --remote
```
The password is hashed locally; only the hash reaches D1. Clear it from your shell history afterwards.

## 4. Secrets and variables
| Name | Type | Purpose |
|---|---|---|
| `IP_HASH_SALT` | **secret** | Salt for hashing IPs (rate limits, verification events). `openssl rand -hex 32 \| npx wrangler secret put IP_HASH_SALT` |
| `PUBLIC_BASE_URL` | var (`wrangler.jsonc`) | Origin used in QR codes, PDFs and share links. Default `https://verify.monarchplacements.in`. |
| `DB` | D1 binding | Configured in `wrangler.jsonc`. |
| `ASSETS` | assets binding | Configured in `wrangler.jsonc`. |

Nothing secret is bundled into the frontend. Use `.dev.vars` (gitignored) locally.

## 5. Deploy
Either from your machine:
```bash
npm run deploy
```
or via GitHub: Cloudflare dashboard → Workers & Pages → Create → Import a repository → this repo. Build command `npm run build`, deploy command `npx wrangler deploy`. Add `IP_HASH_SALT` under Settings → Variables and Secrets. Every push to the production branch then deploys.

Why Workers rather than classic Pages: this app is one Worker serving both static assets and `/api/*`. Cloudflare's current guidance favours Workers with static assets for new full-stack projects; Pages Functions would split the API from the frontend.

## 6. Smoke test on the `*.workers.dev` URL
Home loads; `/certificate/MPS-2026-ZZZZZZZZ` shows "Credential not found"; `/admin/login` works; response headers include `Content-Security-Policy`.

## 7. Custom domain `verify.monarchplacements.in`
**Important constraint:** a Worker custom domain (Workers → your Worker → Settings → Domains & Routes → Add → Custom Domain) requires the hostname's zone to be active on Cloudflare DNS. Your DNS is currently at GoDaddy, so there are three options. Do not guess DNS targets; use exactly what Cloudflare shows.

1. **Keep GoDaddy DNS and wait.** Use the `workers.dev` URL until you decide. Nothing on `monarchplacements.in` changes.
2. **Move the DNS zone `monarchplacements.in` to Cloudflare (free plan).** This is the supported free route. It does require changing nameservers at GoDaddy, so it touches the main domain's DNS. Before switching: Cloudflare imports existing records; compare them line-by-line (A, CNAME, MX, TXT/SPF/DKIM) with GoDaddy's zone file so website and email keep working. Then add the custom domain to the Worker.
3. **Cloudflare for SaaS / partial (CNAME) setup** lets you keep nameservers at GoDaddy and point only the subdomain, but those features have plan requirements that must be checked in the dashboard; they may not be free.

You asked not to change nameservers unless necessary. For a free Cloudflare-hosted subdomain it likely is necessary (option 2). The alternative is hosting only on `workers.dev`, which does not meet the requested URL.

### If you choose option 2
1. Cloudflare → Add a site → `monarchplacements.in` → Free plan. Review the imported records and fix gaps.
2. Cloudflare shows two nameservers. At GoDaddy: Domain → DNS → Nameservers → Change → "I'll use my own nameservers" → enter exactly those two.
3. Wait until Cloudflare marks the zone **Active** (minutes to 24 hours). Verify the main website and email still work.
4. Worker → Domains & Routes → Add Custom Domain → `verify.monarchplacements.in`. Cloudflare creates the DNS record and issues the TLS certificate automatically.
5. SSL/TLS → set mode to **Full (strict)**; enable "Always Use HTTPS". Universal SSL certificates are issued by Cloudflare at no cost; allow a few minutes.
6. Confirm `PUBLIC_BASE_URL` matches, redeploy, then issue a test credential and scan its QR code.

## 8. Operations
- Backups: `npx wrangler d1 export monarch-credentials --remote --output backup.sql` on a schedule you control. D1 also offers Time Travel point-in-time restore (check retention for your plan).
- Rotating `IP_HASH_SALT` only resets the rate-limit and verification-event grouping.
- Users: create and disable in **Admin → Users**. Disabling signs the user out immediately.
