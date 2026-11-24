# Operating costs and limits

> **Unverified.** The build environment could not reach Cloudflare's documentation. The figures below come from general knowledge of the Free plan and must be confirmed before launch:
> - https://developers.cloudflare.com/workers/platform/limits/
> - https://developers.cloudflare.com/workers/platform/pricing/
> - https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/platform/pricing/

| Resource | Free plan (as last known) | Where this app uses it |
|---|---|---|
| Workers requests | ~100,000 per day | Every page load makes a few static-asset requests (assets are free and unlimited) plus API calls. Each verification = 1 Worker request. |
| Worker CPU | ~10 ms per request | PBKDF2 login (100k iterations) and PDF rendering are the heavy paths; PDF generation is CPU-intensive and **could hit the free CPU limit under load**. Measure with `wrangler tail`. If it does, the Workers Paid plan (about US$5/month) raises it. |
| Worker bundle size | ~3 MB compressed | Bundle is ~1.2 MB (330 KB gzip). |
| D1 storage | ~5 GB | Rows are small; certificates number in the thousands. |
| D1 reads / writes | ~5 M rows read, ~100 k rows written per day | Each lookup writes one `verification_events` row and a rate-limit counter. ~100 k lookups per day is the practical ceiling. |
| Custom domain + TLS | Included | |
| R2 | Not used | PDFs are generated on demand. |

Expected cost at modest volume (hundreds of certificates, thousands of verifications a month): **US$0**. Likely first costs, in order: the Workers Paid plan if PDF generation or request volume outgrows the free CPU/request limits, then D1 usage beyond the free allowance. A domain registration at GoDaddy is unchanged. No paid third-party services are used.
