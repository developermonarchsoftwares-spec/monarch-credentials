import { Hono } from "hono";
import type { AppEnv } from "../env";
import { audit, isUniqueViolation, nowIso } from "../lib/db";
import { issuerScope } from "../lib/rbac";
import { requireWriter } from "../lib/session";
import { listQuerySchema, nameKey, studentSchema } from "../lib/validation";

export const studentRoutes = new Hono<AppEnv>();

type StudentRow = { id: number; full_name: string; email: string | null; phone: string | null; notes: string | null; created_at: string; updated_at: string };
const toStudent = (r: StudentRow) => ({
  id: r.id, fullName: r.full_name, email: r.email, phone: r.phone, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at,
});

studentRoutes.get("/", async (c) => {
  const q = listQuerySchema.safeParse(c.req.query());
  if (!q.success) return c.json({ error: "Invalid query" }, 400);
  const { page, pageSize } = q.data;
  const like = q.data.q ? `%${q.data.q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%` : null;
  const where = `s.deleted_at IS NULL ${like ? "AND (s.name_key LIKE ? ESCAPE '\\' OR s.email LIKE ? ESCAPE '\\')" : ""}`;
  const params = like ? [like, like] : [];
  const [scopeSql, scopeParams] = issuerScope(c.get("user"), "c.issuer_id");

  const total = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM students s WHERE ${where}`).bind(...params).first<{ n: number }>();
  const rows = await c.env.DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM certificates c WHERE c.student_id = s.id AND c.deleted_at IS NULL AND ${scopeSql}) AS certificate_count
       FROM students s WHERE ${where} ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?`,
  )
    .bind(...scopeParams, ...params, pageSize, (page - 1) * pageSize)
    .all<StudentRow & { certificate_count: number }>();
  return c.json({
    items: rows.results.map((r) => ({ ...toStudent(r), certificateCount: r.certificate_count })),
    total: total?.n ?? 0, page, pageSize,
  });
});

studentRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "Not found" }, 404);
  const s = await c.env.DB.prepare("SELECT * FROM students WHERE id = ? AND deleted_at IS NULL").bind(id).first<StudentRow>();
  if (!s) return c.json({ error: "Student not found" }, 404);
  const [scopeSql, scopeParams] = issuerScope(c.get("user"), "c.issuer_id");
  const certs = await c.env.DB.prepare(
    `SELECT c.certificate_id, c.title, c.programme, c.status, c.issue_date, c.created_at, i.name AS issuer_name
       FROM certificates c JOIN issuers i ON i.id = c.issuer_id
      WHERE c.student_id = ? AND c.deleted_at IS NULL AND ${scopeSql} ORDER BY c.created_at DESC`,
  ).bind(id, ...scopeParams).all<{ certificate_id: string; title: string; programme: string; status: string; issue_date: string | null; created_at: string; issuer_name: string }>();
  return c.json({
    student: toStudent(s),
    certificates: certs.results.map((r) => ({
      certificateId: r.certificate_id, title: r.title, programme: r.programme, status: r.status,
      issueDate: r.issue_date, createdAt: r.created_at, issuerName: r.issuer_name,
    })),
  });
});

/** Possible duplicates: same email (blocked by unique index) or same normalised name. */
const findDuplicates = (db: D1Database, key: string, email: string | undefined, excludeId: number) =>
  db
    .prepare(
      `SELECT id, full_name, email FROM students WHERE deleted_at IS NULL AND id != ? AND (name_key = ? ${email ? "OR email = ?" : ""}) LIMIT 5`,
    )
    .bind(...[excludeId, key, ...(email ? [email] : [])])
    .all<{ id: number; full_name: string; email: string | null }>();

studentRoutes.post("/", requireWriter, async (c) => {
  const parsed = studentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const key = nameKey(d.fullName);
  const dups = await findDuplicates(c.env.DB, key, d.email, 0);
  if (dups.results.length && !d.confirmDuplicate) {
    const sameEmail = dups.results.some((x) => d.email && x.email === d.email);
    return c.json(
      {
        error: sameEmail ? "A student with this email already exists." : "A student with the same name already exists.",
        code: sameEmail ? "duplicate_email" : "possible_duplicate",
        duplicates: dups.results.map((x) => ({ id: x.id, fullName: x.full_name, email: x.email })),
      },
      409,
    );
  }
  const user = c.get("user");
  try {
    const res = await c.env.DB.prepare(
      "INSERT INTO students (full_name, name_key, email, phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    )
      .bind(d.fullName, key, d.email ?? null, d.phone || null, d.notes || null, user.id)
      .first<{ id: number }>();
    await audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "student.create", entityType: "student", entityId: res?.id, ipHash: c.get("ipHash") }).run();
    return c.json({ id: res?.id }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: "A student with this email already exists.", code: "duplicate_email" }, 409);
    throw e;
  }
});

studentRoutes.put("/:id", requireWriter, async (c) => {
  const id = Number(c.req.param("id"));
  const parsed = studentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const key = nameKey(d.fullName);
  const existing = await c.env.DB.prepare("SELECT id FROM students WHERE id = ? AND deleted_at IS NULL").bind(id).first();
  if (!existing) return c.json({ error: "Student not found" }, 404);
  const dups = await findDuplicates(c.env.DB, key, d.email, id);
  if (dups.results.length && !d.confirmDuplicate) {
    return c.json({ error: "Another student matches this name or email.", code: "possible_duplicate", duplicates: dups.results.map((x) => ({ id: x.id, fullName: x.full_name, email: x.email })) }, 409);
  }
  const user = c.get("user");
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE students SET full_name=?, name_key=?, email=?, phone=?, notes=?, updated_at=? WHERE id=?")
        .bind(d.fullName, key, d.email ?? null, d.phone || null, d.notes || null, nowIso(), id),
      audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "student.update", entityType: "student", entityId: id, ipHash: c.get("ipHash") }),
    ]);
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: "A student with this email already exists.", code: "duplicate_email" }, 409);
    throw e;
  }
  return c.json({ ok: true });
});

studentRoutes.delete("/:id", requireWriter, async (c) => {
  const id = Number(c.req.param("id"));
  const used = await c.env.DB.prepare("SELECT 1 AS x FROM certificates WHERE student_id = ? AND deleted_at IS NULL LIMIT 1").bind(id).first();
  if (used) return c.json({ error: "This student has certificates and cannot be removed." }, 409);
  const user = c.get("user");
  const res = await c.env.DB.prepare("UPDATE students SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL").bind(nowIso(), id).run();
  if (!res.meta.changes) return c.json({ error: "Student not found" }, 404);
  await audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "student.delete", entityType: "student", entityId: id, ipHash: c.get("ipHash") }).run();
  return c.json({ ok: true });
});
