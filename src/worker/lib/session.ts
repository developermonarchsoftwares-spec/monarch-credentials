import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { randomToken, sha256Hex, timingSafeEqual } from "./crypto";
import { buildSessionUser, type RoleRow } from "./rbac";
import { hashIp } from "./db";

export const SESSION_COOKIE = "mc_session";
const SESSION_TTL_HOURS = 8;

export const createSession = async (c: Context<AppEnv>, userId: number): Promise<string> => {
  const token = randomToken(32);
  const csrf = randomToken(16);
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString();
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, csrf, expires)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
  return csrf;
};

export const destroySession = async (c: Context<AppEnv>): Promise<void> => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
};

/** Requires a valid session, loads the user + roles and enforces CSRF on mutating requests. */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "Authentication required" }, 401);
  const tokenHash = await sha256Hex(token);
  const row = await c.env.DB.prepare(
    `SELECT s.csrf_token, s.expires_at, u.id, u.email, u.name
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND u.is_active = 1 AND u.deleted_at IS NULL`,
  )
    .bind(tokenHash)
    .first<{ csrf_token: string; expires_at: string; id: number; email: string; name: string }>();
  if (!row || row.expires_at < new Date().toISOString()) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ error: "Session expired. Please sign in again." }, 401);
  }

  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD") {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "Cross-origin request blocked" }, 403);
    const sent = c.req.header("x-csrf-token") ?? "";
    if (!timingSafeEqual(sent, row.csrf_token)) return c.json({ error: "Invalid CSRF token" }, 403);
  }

  const roles = await c.env.DB.prepare(
    `SELECT r.key, r.name, r.issuer_id, r.can_write FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?`,
  )
    .bind(row.id)
    .all<RoleRow>();
  c.set("user", buildSessionUser({ id: row.id, email: row.email, name: row.name }, roles.results));
  c.set("csrfToken", row.csrf_token);
  c.set("ipHash", await hashIp(c));
  await next();
};

export const requireWriter: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user").canWrite) return c.json({ error: "Your role is read-only" }, 403);
  await next();
};

export const requireSuperAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user").isSuperAdmin) return c.json({ error: "Super Admin access required" }, 403);
  await next();
};
