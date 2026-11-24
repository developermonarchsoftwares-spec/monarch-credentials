import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../env";
import type { PublicCertificate, PublicIssuer, SearchResult, TemplateKey } from "../../shared/types";
import { normaliseCertificateId } from "../lib/ids";
import { hashIp, rateLimit } from "../lib/db";
import { generateCertificatePdf } from "../lib/pdf";
import { sha256Hex } from "../lib/crypto";
import { nameKey, searchByNameSchema } from "../lib/validation";

export const publicRoutes = new Hono<AppEnv>();

// Everything below is unauthenticated and read-only. Responses are never cached so revocation is instant.
publicRoutes.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

type CertRow = {
  id: number;
  certificate_id: string;
  status: "valid" | "revoked";
  full_name: string;
  title: string;
  programme: string;
  description: string | null;
  issuer_name: string;
  issuer_slug: string;
  logo_path: string | null;
  issue_date: string | null;
  start_date: string | null;
  completion_date: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  signatory_name: string | null;
  signatory_designation: string | null;
  template: TemplateKey;
};

const CERT_SELECT = `
  SELECT c.id, c.certificate_id, c.status, s.full_name, c.title, c.programme, c.description,
         i.name AS issuer_name, i.slug AS issuer_slug, i.logo_path, c.issue_date, c.start_date,
         c.completion_date, c.revoked_at, c.revoked_reason, i.signatory_name, i.signatory_designation, t.template
    FROM certificates c
    JOIN students s ON s.id = c.student_id AND s.deleted_at IS NULL
    JOIN issuers i ON i.id = c.issuer_id
    JOIN certificate_types t ON t.id = c.type_id
   WHERE c.status IN ('valid','revoked') AND c.deleted_at IS NULL`;

const verifyUrl = (c: Context<AppEnv>, id: string) => `${c.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/certificate/${id}`;

const toPublic = (c: Context<AppEnv>, r: CertRow): PublicCertificate => ({
  certificateId: r.certificate_id,
  status: r.status,
  studentName: r.full_name,
  title: r.title,
  programme: r.programme,
  description: r.description,
  issuerName: r.issuer_name,
  issuerSlug: r.issuer_slug,
  issuerLogoPath: r.logo_path,
  issueDate: r.issue_date,
  startDate: r.start_date,
  completionDate: r.completion_date,
  revokedAt: r.revoked_at,
  revokedReason: r.revoked_reason,
  verifyUrl: verifyUrl(c, r.certificate_id),
});

const logEvent = (
  c: Context<AppEnv>,
  e: { certId: number | null; query: string; channel: "page" | "search" | "pdf"; result: "valid" | "revoked" | "not_found"; ipHash: string },
) =>
  c.env.DB.prepare(
    "INSERT INTO verification_events (certificate_id, query, channel, result, ip_hash) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(e.certId, e.query.slice(0, 40), e.channel, e.result, e.ipHash)
    .run();

publicRoutes.get("/issuers", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT slug, name, tagline, description, logo_path, website, contact_email, contact_phone, address FROM issuers ORDER BY id",
  ).all<Record<string, string | null>>();
  const issuers: PublicIssuer[] = rows.results.map((r) => ({
    slug: r.slug as string,
    name: r.name as string,
    tagline: r.tagline as string,
    description: r.description as string,
    logoPath: r.logo_path ?? null,
    website: r.website ?? null,
    contactEmail: r.contact_email ?? null,
    contactPhone: r.contact_phone ?? null,
    address: r.address ?? null,
  }));
  const types = await c.env.DB.prepare(
    `SELECT i.slug, t.code, t.name, t.description FROM certificate_types t JOIN issuers i ON i.id = t.issuer_id WHERE t.is_active = 1 ORDER BY t.id`,
  ).all<{ slug: string; code: string; name: string; description: string }>();
  return c.json({ issuers, credentialTypes: types.results });
});

publicRoutes.get("/certificates/:id", async (c) => {
  const ipHash = await hashIp(c);
  if (!(await rateLimit(c.env.DB, `verify:${ipHash}`, 60, 60))) {
    return c.json({ error: "Too many requests. Please wait a minute and try again." }, 429);
  }
  const id = normaliseCertificateId(c.req.param("id"));
  if (!id) return c.json({ error: "That certificate ID is not in a valid format.", code: "invalid_format" }, 400);

  const row = await c.env.DB.prepare(`${CERT_SELECT} AND c.certificate_id = ?`).bind(id).first<CertRow>();
  if (!row) {
    await logEvent(c, { certId: null, query: id, channel: "page", result: "not_found", ipHash });
    return c.json({ error: "No credential was found with this ID.", code: "not_found" }, 404);
  }
  await logEvent(c, { certId: row.id, query: id, channel: "page", result: row.status, ipHash });
  return c.json({ certificate: toPublic(c, row) });
});

publicRoutes.get("/certificates/:id/pdf", async (c) => {
  const ipHash = await hashIp(c);
  if (!(await rateLimit(c.env.DB, `pdf:${ipHash}`, 20, 60))) return c.json({ error: "Too many requests." }, 429);
  const id = normaliseCertificateId(c.req.param("id"));
  if (!id) return c.json({ error: "Invalid certificate ID" }, 400);
  const row = await c.env.DB.prepare(`${CERT_SELECT} AND c.certificate_id = ?`).bind(id).first<CertRow>();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.status === "revoked") return c.json({ error: "This credential has been revoked and cannot be downloaded." }, 410);
  if (!row.issue_date || !row.signatory_name || !row.signatory_designation) {
    return c.json({ error: "Certificate cannot be rendered yet" }, 409);
  }

  const bytes = await generateCertificatePdf({
    certificateId: row.certificate_id,
    studentName: row.full_name,
    title: row.title,
    programme: row.programme,
    description: row.description,
    startDate: row.start_date,
    completionDate: row.completion_date,
    issueDate: row.issue_date,
    issuerName: row.issuer_name,
    issuerSlug: row.issuer_slug,
    signatoryName: row.signatory_name,
    signatoryDesignation: row.signatory_designation,
    template: row.template,
    verifyUrl: verifyUrl(c, row.certificate_id),
  });
  const hash = await sha256Hex(bytes);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO certificate_files (certificate_id, kind, template, sha256, size_bytes)
       SELECT ?, 'pdf', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM certificate_files WHERE certificate_id = ? AND sha256 = ?)`,
    ).bind(row.id, row.template, hash, bytes.length, row.id, hash),
    c.env.DB.prepare(
      "INSERT INTO verification_events (certificate_id, query, channel, result, ip_hash) VALUES (?, ?, 'pdf', 'valid', ?)",
    ).bind(row.id, id, ipHash),
  ]);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.certificate_id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});

const maskName = (full: string): string =>
  full
    .split(" ")
    .map((p) => (p.length <= 1 ? p : `${p[0]}${"•".repeat(Math.min(p.length - 1, 6))}`))
    .join(" ");

// Name search: exact full-name match within one issuer, masked output, stricter rate limit.
publicRoutes.post("/search", async (c) => {
  const ipHash = await hashIp(c);
  if (!(await rateLimit(c.env.DB, `search:${ipHash}`, 10, 60))) {
    return c.json({ error: "Too many searches. Please wait a minute and try again." }, 429);
  }
  const parsed = searchByNameSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !parsed.data.name.includes(" ")) {
    return c.json({ error: "Enter the learner's full name exactly as it appears on the certificate." }, 400);
  }
  const rows = await c.env.DB.prepare(
    `${CERT_SELECT} AND s.name_key = ? AND i.slug = ? ORDER BY c.published_at DESC LIMIT 5`,
  )
    .bind(nameKey(parsed.data.name), parsed.data.issuer)
    .all<CertRow>();
  await logEvent(c, { certId: null, query: "name-search", channel: "search", result: rows.results.length ? "valid" : "not_found", ipHash });
  const results: SearchResult[] = rows.results.map((r) => ({
    certificateId: r.certificate_id,
    maskedName: maskName(r.full_name),
    title: r.title,
    programme: r.programme,
    issuerName: r.issuer_name,
    issueDate: r.issue_date,
    status: r.status,
  }));
  return c.json({ results });
});
