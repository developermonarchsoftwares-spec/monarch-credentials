import type { Context } from "hono";
import type { AppEnv } from "../env";
import { sha256Hex } from "./crypto";

export const nowIso = () => new Date().toISOString();
export const todayIso = () => new Date().toISOString().slice(0, 10);

export const clientIp = (c: Context<AppEnv>): string =>
  c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

export const hashIp = async (c: Context<AppEnv>): Promise<string> => {
  const salt = c.env.IP_HASH_SALT;
  if (!salt) throw new Error("IP_HASH_SALT is not configured");
  return (await sha256Hex(`${salt}:${clientIp(c)}`)).slice(0, 32);
};

/** Fixed-window rate limiter backed by D1. Returns true if the request is allowed. */
export const rateLimit = async (
  db: D1Database,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> => {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(bucket, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(bucket, windowStart)
    .first<{ count: number }>();
  if (Math.random() < 0.02) {
    // Opportunistic cleanup of expired windows.
    await db.prepare("DELETE FROM rate_limits WHERE window_start < ?").bind(windowStart - 86_400).run();
  }
  return (row?.count ?? 1) <= limit;
};

export const audit = (
  db: D1Database,
  entry: {
    userId: number | null;
    userEmail: string | null;
    action: string;
    entityType?: string;
    entityId?: string | number;
    details?: Record<string, unknown>;
    ipHash?: string;
  },
): D1PreparedStatement =>
  db
    .prepare(
      `INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.userId,
      entry.userEmail,
      entry.action,
      entry.entityType ?? null,
      entry.entityId === undefined ? null : String(entry.entityId),
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ipHash ?? null,
    );

export const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Error && /UNIQUE constraint failed/i.test(`${e.message} ${(e as { cause?: Error }).cause?.message ?? ""}`);

/** Audit row that is only written if the previous statement in the batch changed a row. */
export const auditIfChanged = (
  db: D1Database,
  entry: { userId: number; userEmail: string; action: string; entityType: string; entityId: string; details?: Record<string, unknown>; ipHash?: string },
): D1PreparedStatement =>
  db
    .prepare(
      `INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, ip_hash)
       SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0`,
    )
    .bind(entry.userId, entry.userEmail, entry.action, entry.entityType, entry.entityId, entry.details ? JSON.stringify(entry.details) : null, entry.ipHash ?? null);
