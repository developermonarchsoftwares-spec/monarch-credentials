import { app } from "../../src/worker/index";
import { createTestDb } from "./d1";
import { hashPassword } from "../../src/worker/lib/crypto";
import type { Env } from "../../src/worker/env";

export const PASSWORD = "correct-horse-battery-1";

export const createHarness = async () => {
  const { db, sqlite } = createTestDb();
  const env: Env = { DB: db, ASSETS: { fetch: async () => new Response("asset") } as unknown as Fetcher, PUBLIC_BASE_URL: "https://verify.monarchplacements.in", IP_HASH_SALT: "test-salt" };
  const hash = await hashPassword(PASSWORD);

  const addUser = (email: string, role: string) => {
    sqlite.prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)").run(email, "Test User", hash);
    sqlite.prepare("INSERT INTO user_roles (user_id, role_id) SELECT (SELECT id FROM users WHERE email=?), id FROM roles WHERE key=?").run(email, role);
  };
  addUser("super@test.in", "super_admin");
  addUser("placements@test.in", "placements_admin");
  addUser("softwares@test.in", "softwares_admin");
  addUser("viewer@test.in", "viewer");

  let ipCounter = 0;
  const call = (path: string, init: RequestInit & { ip?: string; headers?: Record<string, string> } = {}) =>
    app.fetch(new Request(`https://verify.monarchplacements.in${path}`, { ...init, headers: { "cf-connecting-ip": init.ip ?? `10.0.0.${++ipCounter % 250}`, ...init.headers } }), env);

  type Session = { cookie: string; csrf: string };
  const login = async (email: string, password = PASSWORD, ip?: string): Promise<Session> => {
    const res = await call("/api/auth/login", { method: "POST", ip, headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (res.status !== 200) throw new Error(`login failed ${res.status}`);
    const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
    const { csrfToken } = (await res.json()) as { csrfToken: string };
    return { cookie, csrf: csrfToken };
  };
  const api = (s: Session, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) =>
    call(`/api/admin${path}`, { method, headers: { cookie: s.cookie, "x-csrf-token": s.csrf, ...(body ? { "content-type": "application/json" } : {}), ...extra }, body: body ? JSON.stringify(body) : undefined });

  return { call, login, api, sqlite, env, addUser };
};
