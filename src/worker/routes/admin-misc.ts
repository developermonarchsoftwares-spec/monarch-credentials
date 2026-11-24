import { Hono } from "hono";
import type { AppEnv } from "../env";
import { hashPassword } from "../lib/crypto";
import { audit, isUniqueViolation, nowIso } from "../lib/db";
import { canReadIssuer, canWriteIssuer, issuerScope } from "../lib/rbac";
import { requireSuperAdmin, requireWriter } from "../lib/session";
import { issuerUpdateSchema, userCreateSchema, userUpdateSchema } from "../lib/validation";

export const miscRoutes = new Hono<AppEnv>();

// ---------- Issuers ----------
type IssuerRow = {
  id: number; slug: string; name: string; tagline: string; description: string; logo_path: string | null; website: string | null;
  contact_email: string | null; contact_phone: string | null; address: string | null; signatory_name: string | null; signatory_designation: string | null;
};
const toIssuer = (r: IssuerRow, writable: boolean) => ({
  id: r.id, slug: r.slug, name: r.name, tagline: r.tagline, description: r.description, logoPath: r.logo_path, website: r.website,
  contactEmail: r.contact_email, contactPhone: r.contact_phone, address: r.address,
  signatoryName: r.signatory_name, signatoryDesignation: r.signatory_designation, writable,
});

miscRoutes.get("/issuers", async (c) => {
  const user = c.get("user");
  const rows = await c.env.DB.prepare("SELECT * FROM issuers ORDER BY id").all<IssuerRow>();
  return c.json({ issuers: rows.results.filter((r) => canReadIssuer(user, r.id)).map((r) => toIssuer(r, canWriteIssuer(user, r.id))) });
});

miscRoutes.put("/issuers/:slug", requireWriter, async (c) => {
  const user = c.get("user");
  const issuer = await c.env.DB.prepare("SELECT id FROM issuers WHERE slug = ?").bind(c.req.param("slug")).first<{ id: number }>();
  if (!issuer || !canReadIssuer(user, issuer.id)) return c.json({ error: "Issuer not found" }, 404);
  if (!canWriteIssuer(user, issuer.id)) return c.json({ error: "You cannot modify this issuer" }, 403);
  const parsed = issuerUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE issuers SET tagline=?, description=?, website=?, contact_email=?, contact_phone=?, address=?, signatory_name=?, signatory_designation=?, updated_at=? WHERE id=?`,
    ).bind(d.tagline, d.description, d.website, d.contactEmail, d.contactPhone, d.address, d.signatoryName, d.signatoryDesignation, nowIso(), issuer.id),
    audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "issuer.update", entityType: "issuer", entityId: c.req.param("slug"), ipHash: c.get("ipHash") }),
  ]);
  return c.json({ ok: true });
});

// ---------- Dashboard ----------
miscRoutes.get("/stats", async (c) => {
  const user = c.get("user");
  const [scope, scopeP] = issuerScope(user, "c.issuer_id");
  const scoped = `c.deleted_at IS NULL AND ${scope}`;
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const sixMonthsAgo = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5, 1)).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
  const allAccess = user.readableIssuerIds === "all";

  const [counts, students, month, byMonth, byIssuer, verif, verifTotal] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) AS total, SUM(c.status='valid') AS valid, SUM(c.status='revoked') AS revoked, SUM(c.status='draft') AS draft FROM certificates c WHERE ${scoped}`).bind(...scopeP),
    allAccess
      ? c.env.DB.prepare("SELECT COUNT(*) AS n FROM students WHERE deleted_at IS NULL")
      : c.env.DB.prepare(`SELECT COUNT(DISTINCT c.student_id) AS n FROM certificates c WHERE ${scoped}`).bind(...scopeP),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM certificates c WHERE ${scoped} AND c.published_at >= ?`).bind(...scopeP, monthStart),
    c.env.DB.prepare(`SELECT strftime('%Y-%m', c.published_at) AS m, COUNT(*) AS n FROM certificates c WHERE ${scoped} AND c.published_at >= ? GROUP BY m`).bind(...scopeP, sixMonthsAgo),
    c.env.DB.prepare(`SELECT i.name AS name, COUNT(*) AS n FROM certificates c JOIN issuers i ON i.id = c.issuer_id WHERE ${scoped} AND c.status != 'draft' GROUP BY i.id ORDER BY i.id`).bind(...scopeP),
    c.env.DB.prepare(
      `SELECT substr(e.created_at,1,10) AS d, COUNT(*) AS n FROM verification_events e LEFT JOIN certificates c ON c.id = e.certificate_id
        WHERE substr(e.created_at,1,10) >= ? AND (e.certificate_id IS NULL AND ${allAccess ? "1=1" : "1=0"} OR e.certificate_id IS NOT NULL AND ${scope}) GROUP BY d`,
    ).bind(fourteenDaysAgo, ...scopeP),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM verification_events e LEFT JOIN certificates c ON c.id = e.certificate_id
        WHERE (e.certificate_id IS NULL AND ${allAccess ? "1=1" : "1=0"} OR e.certificate_id IS NOT NULL AND ${scope})`,
    ).bind(...scopeP),
  ]);
  const one = (r: D1Result | undefined) => (r?.results[0] ?? {}) as Record<string, number | null>;
  const monthMap = new Map((byMonth?.results as { m: string; n: number }[]).map((r) => [r.m, r.n]));
  const issuedByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 5 + i, 1));
    const key = d.toISOString().slice(0, 7);
    return { month: key, count: monthMap.get(key) ?? 0 };
  });
  const dayMap = new Map((verif?.results as { d: string; n: number }[]).map((r) => [r.d, r.n]));
  const verificationsByDay = Array.from({ length: 14 }, (_, i) => {
    const key = new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10);
    return { date: key, count: dayMap.get(key) ?? 0 };
  });
  const cnt = one(counts);
  return c.json({
    totals: { certificates: cnt.total ?? 0, valid: cnt.valid ?? 0, revoked: cnt.revoked ?? 0, drafts: cnt.draft ?? 0, students: one(students).n ?? 0, issuedThisMonth: one(month).n ?? 0, verifications: one(verifTotal).n ?? 0 },
    issuedByMonth, verificationsByDay,
    byIssuer: (byIssuer?.results as { name: string; n: number }[]).map((r) => ({ name: r.name, count: r.n })),
  });
});

// ---------- Audit log (Super Admin) ----------
miscRoutes.get("/audit", requireSuperAdmin, async (c) => {
  const page = Math.max(1, Number(c.req.query("page") ?? 1) || 1);
  const pageSize = 30;
  const total = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM audit_logs").first<{ n: number }>();
  const rows = await c.env.DB.prepare("SELECT id, user_email, action, entity_type, entity_id, details, created_at FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?")
    .bind(pageSize, (page - 1) * pageSize).all<{ id: number; user_email: string | null; action: string; entity_type: string | null; entity_id: string | null; details: string | null; created_at: string }>();
  return c.json({
    items: rows.results.map((r) => ({ id: r.id, by: r.user_email, action: r.action, entityType: r.entity_type, entityId: r.entity_id, details: r.details ? JSON.parse(r.details) : null, at: r.created_at })),
    total: total?.n ?? 0, page, pageSize,
  });
});

// ---------- Users (Super Admin) ----------
const userSelect = `SELECT u.id, u.email, u.name, u.is_active, u.last_login_at, u.created_at, r.key AS role
  FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id WHERE u.deleted_at IS NULL`;
type UserRow = { id: number; email: string; name: string; is_active: number; last_login_at: string | null; created_at: string; role: string | null };
const toUser = (r: UserRow) => ({ id: r.id, email: r.email, name: r.name, isActive: r.is_active === 1, lastLoginAt: r.last_login_at, createdAt: r.created_at, role: r.role });

miscRoutes.get("/users", requireSuperAdmin, async (c) => {
  const rows = await c.env.DB.prepare(`${userSelect} ORDER BY u.id`).all<UserRow>();
  return c.json({ users: rows.results.map(toUser) });
});

miscRoutes.post("/users", requireSuperAdmin, async (c) => {
  const parsed = userCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const actor = c.get("user");
  const hash = await hashPassword(d.password);
  try {
    const [res] = await c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id").bind(d.email, d.name, hash),
      c.env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (last_insert_rowid(), (SELECT id FROM roles WHERE key = ?))").bind(d.role),
      audit(c.env.DB, { userId: actor.id, userEmail: actor.email, action: "user.create", entityType: "user", entityId: d.email, details: { role: d.role }, ipHash: c.get("ipHash") }),
    ]);
    return c.json({ id: (res?.results[0] as { id: number } | undefined)?.id }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return c.json({ error: "A user with this email already exists." }, 409);
    throw e;
  }
});

miscRoutes.put("/users/:id", requireSuperAdmin, async (c) => {
  const id = Number(c.req.param("id"));
  const actor = c.get("user");
  const parsed = userUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid input", issues: parsed.error.issues }, 400);
  const d = parsed.data;
  const target = await c.env.DB.prepare(`${userSelect} AND u.id = ?`).bind(id).first<UserRow>();
  if (!target) return c.json({ error: "User not found" }, 404);

  const losingSuper = target.role === "super_admin" && ((d.role && d.role !== "super_admin") || d.isActive === false);
  if (losingSuper) {
    if (id === actor.id) return c.json({ error: "You cannot demote or deactivate your own Super Admin account." }, 409);
    const others = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id WHERE r.key='super_admin' AND u.is_active=1 AND u.deleted_at IS NULL AND u.id != ?`,
    ).bind(id).first<{ n: number }>();
    if (!others?.n) return c.json({ error: "At least one active Super Admin must remain." }, 409);
  }
  if (id === actor.id && d.isActive === false) return c.json({ error: "You cannot deactivate your own account." }, 409);

  const stmts: D1PreparedStatement[] = [];
  if (d.name) stmts.push(c.env.DB.prepare("UPDATE users SET name=?, updated_at=? WHERE id=?").bind(d.name, nowIso(), id));
  if (d.isActive !== undefined) {
    stmts.push(c.env.DB.prepare("UPDATE users SET is_active=?, updated_at=? WHERE id=?").bind(d.isActive ? 1 : 0, nowIso(), id));
    if (!d.isActive) stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id));
  }
  if (d.role) {
    stmts.push(c.env.DB.prepare("DELETE FROM user_roles WHERE user_id=?").bind(id));
    stmts.push(c.env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, (SELECT id FROM roles WHERE key=?))").bind(id, d.role));
    stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id)); // force re-login with new permissions
  }
  if (d.password) {
    stmts.push(c.env.DB.prepare("UPDATE users SET password_hash=?, updated_at=? WHERE id=?").bind(await hashPassword(d.password), nowIso(), id));
    stmts.push(c.env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id));
  }
  if (!stmts.length) return c.json({ error: "Nothing to update" }, 400);
  stmts.push(audit(c.env.DB, { userId: actor.id, userEmail: actor.email, action: "user.update", entityType: "user", entityId: target.email, details: { role: d.role, isActive: d.isActive, passwordReset: !!d.password, renamed: !!d.name }, ipHash: c.get("ipHash") }));
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});
