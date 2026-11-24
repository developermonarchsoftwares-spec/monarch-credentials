import { Hono } from "hono";
import type { AppEnv } from "../env";
import { DUMMY_HASH, verifyPassword } from "../lib/crypto";
import { audit, hashIp, nowIso, rateLimit } from "../lib/db";
import { createSession, destroySession, requireAuth } from "../lib/session";
import { loginSchema } from "../lib/validation";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "Cross-origin request blocked" }, 403);
  if (!c.req.header("content-type")?.includes("application/json")) return c.json({ error: "Unsupported content type" }, 415);

  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Enter a valid email and password" }, 400);
  const { email, password } = parsed.data;
  const ipHash = await hashIp(c);

  const okIp = await rateLimit(c.env.DB, `login-ip:${ipHash}`, 20, 900);
  const okEmail = await rateLimit(c.env.DB, `login-email:${email}`, 8, 900);
  if (!okIp || !okEmail) return c.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, password_hash FROM users WHERE email = ? AND is_active = 1 AND deleted_at IS NULL",
  )
    .bind(email)
    .first<{ id: number; email: string; name: string; password_hash: string }>();

  const valid = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    await audit(c.env.DB, { userId: null, userEmail: email, action: "auth.login_failed", ipHash }).run();
    return c.json({ error: "Incorrect email or password" }, 401);
  }

  const csrfToken = await createSession(c, user.id);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(nowIso(), user.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(nowIso()),
    audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "auth.login", ipHash }),
  ]);
  return c.json({ ok: true, csrfToken });
});

authRoutes.get("/me", requireAuth, (c) => c.json({ user: c.get("user"), csrfToken: c.get("csrfToken") }));

authRoutes.post("/logout", requireAuth, async (c) => {
  const user = c.get("user");
  await audit(c.env.DB, { userId: user.id, userEmail: user.email, action: "auth.logout", ipHash: c.get("ipHash") }).run();
  await destroySession(c);
  return c.json({ ok: true });
});
