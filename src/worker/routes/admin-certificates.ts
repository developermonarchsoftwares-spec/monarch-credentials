import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../env";
import { audit, auditIfChanged, isUniqueViolation, nowIso, todayIso } from "../lib/db";
import { generateCertificateId, normaliseCertificateId } from "../lib/ids";
import { canReadIssuer, canWriteIssuer, issuerScope } from "../lib/rbac";
import { requireWriter } from "../lib/session";
import { certificateCreateSchema, certificateUpdateSchema, publishSchema, revokeSchema } from "../lib/validation";
import { generateCertificatePdf } from "../lib/pdf";

export const certificateRoutes = new Hono<AppEnv>();

type Row = {
  id: number; certificate_id: string; status: string; title: string; programme: string; description: string | null;
  start_date: string | null; completion_date: string | null; issue_date: string | null; published_at: string | null;
  revoked_at: string | null; revoked_reason: string | null; created_at: string; issuer_id: number; issuer_name: string;
  issuer_slug: string; type_id: number; type_name: string; template: string; student_id: number; student_name: string;
};
const BASE = `SELECT c.id, c.certificate_id, c.status, c.title, c.programme, c.description, c.start_date, c.completion_date,
    c.issue_date, c.published_at, c.revoked_at, c.revoked_reason, c.created_at, c.issuer_id, i.name AS issuer_name, i.slug AS issuer_slug,
    c.type_id, t.name AS type_name, t.template, c.student_id, s.full_name AS student_name
  FROM certificates c JOIN issuers i ON i.id = c.issuer_id JOIN certificate_types t ON t.id = c.type_id JOIN students s ON s.id = c.student_id`;
const toCert = (r: Row) => ({
  certificateId: r.certificate_id, status: r.status, title: r.title, programme: r.programme, description: r.description,
  startDate: r.start_date, completionDate: r.completion_date, issueDate: r.issue_date, publishedAt: r.published_at,
  revokedAt: r.revoked_at, revokedReason: r.revoked_reason, createdAt: r.created_at,
  issuer: { id: r.issuer_id, name: r.issuer_name, slug: r.issuer_slug },
  type: { id: r.type_id, name: r.type_name, template: r.template },
  student: { id: r.student_id, fullName: r.student_name },
});

const listSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["draft", "valid", "revoked"]).optional(),
  issuerId: z.coerce.number().int().positive().optional(),
  typeId: z.coerce.number().int().positive().optional(),
  sort: z.enum(["created_at", "issue_date", "status", "student"]).default("created_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
const SORT_COLUMNS = { created_at: "c.created_at", issue_date: "c.issue_date", status: "c.status", student: "s.name_key" } as const;

certificateRoutes.get("/types", async (c) => {
  const user = c.get("user");
  const rows = await c.env.DB.prepare(
    `SELECT t.id, t.code, t.name, t.template, t.issuer_id, i.name AS issuer_name, i.slug AS issuer_slug
       FROM certificate_types t JOIN issuers i ON i.id = t.issuer_id WHERE t.is_active = 1 ORDER BY t.id`,
  ).all<{ id: number; code: string; name: string; template: string; issuer_id: number; issuer_name: string; issuer_slug: string }>();
  return c.json({
    types: rows.results
      .filter((t) => canReadIssuer(user, t.issuer_id))
      .map((t) => ({ id: t.id, code: t.code, name: t.name, template: t.template, issuerId: t.issuer_id, issuerName: t.issuer_name, issuerSlug: t.issuer_slug, writable: canWriteIssuer(user, t.issuer_id) })),
  });
});

certificateRoutes.get("/", async (c) => {
  const parsed = listSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: "Invalid query" }, 400);
  const f = parsed.data;
  const [scopeSql, scopeParams] = issuerScope(c.get("user"), "c.issuer_id");
  const conds = ["c.deleted_at IS NULL", scopeSql];
  const params: (string | number)[] = [...scopeParams];
  if (f.status) { conds.push("c.status = ?"); params.push(f.status); }
  if (f.issuerId) { conds.push("c.issuer_id = ?"); params.push(f.issuerId); }
  if (f.typeId) { conds.push("c.type_id = ?"); params.push(f.typeId); }
  if (f.q) {
    const like = `%${f.q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
    conds.push("(LOWER(c.certificate_id) LIKE ? ESCAPE '\\' OR s.name_key LIKE ? ESCAPE '\\' OR LOWER(c.programme) LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const where = conds.join(" AND ");
  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM certificates c JOIN students s ON s.id = c.student_id WHERE ${where}`).bind(...params).first<{ n: number }>();
  const rows = await c.env.DB.prepare(`${BASE} WHERE ${where} ORDER BY ${SORT_COLUMNS[f.sort]} ${f.dir === "asc" ? "ASC" : "DESC"}, c.id DESC LIMIT ? OFFSET ?`)
    .bind(...params, f.pageSize, (f.page - 1) * f.pageSize)
    .all<Row>();
  return c.json({ items: rows.results.map(toCert), total: total?.n ?? 0, page: f.page, pageSize: f.pageSize });
});

const loadCert = async (c: { env: AppEnv["Bindings"] }, rawId: string) => {
  const id = normaliseCertificateId(rawId);
  if (!id) return null;
  return c.env.DB.prepare(`${BASE} WHERE c.certificate_id = ? AND c.deleted_at IS NULL`).bind(id).first<Row>();
};

certificateRoutes.get("/:id", async (c) => {
  const row = await loadCert(c, c.req.param("id"));
  if (!row || !canReadIssuer(c.get("user"), row.issuer_id)) return c.json({ error: "Certificate not found" }, 404);
  const [history, stats] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT action, user_email, details, created_at FROM audit_logs WHERE entity_type = 'certificate' AND entity_id = ? ORDER BY id DESC LIMIT 50`).bind(row.certificate_id),
    c.env.DB.prepare(`SELECT COUNT(*) AS n, MAX(created_at) AS last FROM verification_events WHERE certificate_id = ?`).bind(row.id),
  ]);
  const v = (stats?.results[0] ?? {}) as { n?: number; last?: string | null };
  return c.json({
    certificate: toCert(row),
    history: (history?.results ?? []).map((h) => {
      const r = h as { action: string; user_email: string | null; details: string | null; created_at: string };
      return { action: r.action, by: r.user_email, details: r.details ? JSON.parse(r.details) : null, at: r.created_at };
    }),
    verifications: { count: v.n ?? 0, lastAt: v.last ?? null },
  });
});

certificateRoutes.post("/", requireWriter, async (c) => {
  const parsed = certificateCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const user = c.get("user");
  const type = await c.env.DB.prepare("SELECT id, issuer_id, code, name FROM certificate_types WHERE id = ? AND is_active = 1")
    .bind(d.typeId).first<{ id: number; issuer_id: number; code: string; name: string }>();
  if (!type) return c.json({ error: "Unknown certificate type" }, 400);
  if (!canWriteIssuer(user, type.issuer_id)) return c.json({ error: "You cannot issue credentials for this issuer" }, 403);
  const student = await c.env.DB.prepare("SELECT id FROM students WHERE id = ? AND deleted_at IS NULL").bind(d.studentId).first();
  if (!student) return c.json({ error: "Student not found" }, 400);

  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const certificateId = generateCertificateId(type.code, year);
    try {
      // Single atomic batch: the credential and its audit entry are written together or not at all.
      await c.env.DB.batch([
        c.env.DB.prepare(
          `INSERT INTO certificates (certificate_id, student_id, issuer_id, type_id, title, programme, description, start_date, completion_date, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
        ).bind(certificateId, d.studentId, type.issuer_id, type.id, d.title ?? type.name, d.programme, d.description ?? null, d.startDate ?? null, d.completionDate ?? null, user.id),
        audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "certificate.create", entityType: "certificate", entityId: certificateId, ipHash: c.get("ipHash") }),
      ]);
      return c.json({ certificateId }, 201);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // ID collision: draw a fresh ID
    }
  }
  return c.json({ error: "Could not allocate a unique certificate ID. Please retry." }, 503);
});

certificateRoutes.put("/:id", requireWriter, async (c) => {
  const row = await loadCert(c, c.req.param("id"));
  if (!row || !canReadIssuer(c.get("user"), row.issuer_id)) return c.json({ error: "Certificate not found" }, 404);
  if (!canWriteIssuer(c.get("user"), row.issuer_id)) return c.json({ error: "You cannot modify this issuer's credentials" }, 403);
  if (row.status !== "draft") return c.json({ error: "Only draft certificates can be edited. Published credentials are immutable." }, 409);
  const parsed = certificateUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const user = c.get("user");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE certificates SET title=?, programme=?, description=?, start_date=?, completion_date=?, updated_at=? WHERE id=? AND status='draft'")
      .bind(d.title, d.programme, d.description ?? null, d.startDate ?? null, d.completionDate ?? null, nowIso(), row.id),
    auditIfChanged(c.env.DB, { userId: user.id, userEmail: user.email, action: "certificate.update", entityType: "certificate", entityId: row.certificate_id, ipHash: c.get("ipHash") }),
  ]);
  return c.json({ ok: true });
});

certificateRoutes.post("/:id/publish", requireWriter, async (c) => {
  const row = await loadCert(c, c.req.param("id"));
  const user = c.get("user");
  if (!row || !canReadIssuer(user, row.issuer_id)) return c.json({ error: "Certificate not found" }, 404);
  if (!canWriteIssuer(user, row.issuer_id)) return c.json({ error: "You cannot publish this issuer's credentials" }, 403);
  if (row.status !== "draft") return c.json({ error: `Certificate is already ${row.status}` }, 409);
  const parsed = publishSchema.safeParse((await c.req.json().catch(() => ({}))) ?? {});
  if (!parsed.success) return c.json({ error: "Invalid issue date" }, 400);
  const issuer = await c.env.DB.prepare("SELECT signatory_name, signatory_designation FROM issuers WHERE id = ?").bind(row.issuer_id).first<{ signatory_name: string | null; signatory_designation: string | null }>();
  if (!issuer?.signatory_name || !issuer.signatory_designation) {
    return c.json({ error: "Set the authorised signatory name and designation for this issuer before publishing.", code: "signatory_missing" }, 422);
  }
  const issueDate = parsed.data.issueDate ?? todayIso();
  const now = nowIso();
  const [res] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE certificates SET status='valid', issue_date=?, published_at=?, published_by=?, updated_at=? WHERE id=? AND status='draft'")
      .bind(issueDate, now, user.id, now, row.id),
    auditIfChanged(c.env.DB, { userId: user.id, userEmail: user.email, action: "certificate.publish", entityType: "certificate", entityId: row.certificate_id, details: { issueDate }, ipHash: c.get("ipHash") }),
  ]);
  if (!res?.meta.changes) return c.json({ error: "Certificate was changed by someone else. Reload and try again." }, 409);
  return c.json({ ok: true });
});

certificateRoutes.post("/:id/revoke", requireWriter, async (c) => {
  const row = await loadCert(c, c.req.param("id"));
  const user = c.get("user");
  if (!row || !canReadIssuer(user, row.issuer_id)) return c.json({ error: "Certificate not found" }, 404);
  if (!canWriteIssuer(user, row.issuer_id)) return c.json({ error: "You cannot revoke this issuer's credentials" }, 403);
  if (row.status !== "valid") return c.json({ error: "Only valid certificates can be revoked" }, 409);
  const parsed = revokeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "A reason is required" }, 400);
  const now = nowIso();
  const [res] = await c.env.DB.batch([
    c.env.DB.prepare("UPDATE certificates SET status='revoked', revoked_at=?, revoked_reason=?, revoked_by=?, updated_at=? WHERE id=? AND status='valid'")
      .bind(now, parsed.data.reason, user.id, now, row.id),
    auditIfChanged(c.env.DB, { userId: user.id, userEmail: user.email, action: "certificate.revoke", entityType: "certificate", entityId: row.certificate_id, details: { reason: parsed.data.reason }, ipHash: c.get("ipHash") }),
  ]);
  if (!res?.meta.changes) return c.json({ error: "Certificate was changed by someone else. Reload and try again." }, 409);
  return c.json({ ok: true });
});

certificateRoutes.delete("/:id", requireWriter, async (c) => {
  const row = await loadCert(c, c.req.param("id"));
  const user = c.get("user");
  if (!row || !canReadIssuer(user, row.issuer_id)) return c.json({ error: "Certificate not found" }, 404);
  if (!canWriteIssuer(user, row.issuer_id)) return c.json({ error: "You cannot modify this issuer's credentials" }, 403);
  if (row.status !== "draft") return c.json({ error: "Published credentials cannot be deleted. Revoke them instead." }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE certificates SET deleted_at=? WHERE id=? AND status='draft'").bind(nowIso(), row.id),
    auditIfChanged(c.env.DB, { userId: user.id, userEmail: user.email, action: "certificate.delete_draft", entityType: "certificate", entityId: row.certificate_id, ipHash: c.get("ipHash") }),
  ]);
  return c.json({ ok: true });
});

/** Draft/preview PDF for admins (watermark-free; uses today's date for unpublished drafts). */
certificateRoutes.get("/:id/pdf", async (c) => {
  const row = await loadCert(c, c.req.param("id"));
  if (!row || !canReadIssuer(c.get("user"), row.issuer_id)) return c.json({ error: "Certificate not found" }, 404);
  const issuer = await c.env.DB.prepare("SELECT signatory_name, signatory_designation FROM issuers WHERE id = ?").bind(row.issuer_id).first<{ signatory_name: string | null; signatory_designation: string | null }>();
  if (!issuer?.signatory_name || !issuer.signatory_designation) return c.json({ error: "Set the issuer's authorised signatory first." }, 422);
  const bytes = await generateCertificatePdf({
    certificateId: row.certificate_id, studentName: row.student_name, title: row.title, programme: row.programme,
    description: row.description, startDate: row.start_date, completionDate: row.completion_date,
    issueDate: row.issue_date ?? todayIso(), issuerName: row.issuer_name, issuerSlug: row.issuer_slug,
    signatoryName: issuer.signatory_name, signatoryDesignation: issuer.signatory_designation,
    template: row.template as never, verifyUrl: `${c.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/certificate/${row.certificate_id}`,
  });
  return new Response(bytes as BodyInit, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${row.certificate_id}.pdf"`, "Cache-Control": "no-store" } });
});
