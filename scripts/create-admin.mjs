#!/usr/bin/env node
// Creates (or resets) a Super Admin. Cross-platform (Windows, macOS, Linux).
//
//   node scripts/create-admin.mjs --local  --email you@example.com --name "Your Name" --password "12+ chars"
//   node scripts/create-admin.mjs --remote --email ... --name ... --password ...
//
// Environment variables ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD also work, and missing values are prompted for.
// The password is hashed here (PBKDF2-SHA256, 100k iterations: the Workers maximum); only the hash is sent to D1.
import { webcrypto as crypto } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const target = process.argv.includes("--remote") ? "--remote" : "--local";

const ask = async (question, fallback) => {
  if (fallback) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim();
  rl.close();
  return answer;
};

const email = (await ask("Admin email: ", arg("email") ?? process.env.ADMIN_EMAIL)).toLowerCase();
const name = await ask("Admin name: ", arg("name") ?? process.env.ADMIN_NAME);
const password = await ask("Password (12+ characters, shown as you type): ", arg("password") ?? process.env.ADMIN_PASSWORD);

if (!/^[^@\s'"]+@[^@\s'"]+\.[^@\s'"]+$/.test(email)) fail("That email address is not valid.");
if (!name || /['"\\;]/.test(name)) fail("Name is required and cannot contain quotes, backslashes or semicolons.");
if (password.length < 12) fail("Password must be at least 12 characters.");

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = new Uint8Array(
  await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256),
);
const b64 = (u) => Buffer.from(u).toString("base64");
const hash = `pbkdf2-sha256$100000$${b64(salt)}$${b64(bits)}`;

// Idempotent: re-running with the same email resets that user's password and re-assigns Super Admin.
const sql = `
INSERT INTO users (email, name, password_hash) VALUES ('${email}', '${name}', '${hash}')
  ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, is_active = 1, deleted_at = NULL;
INSERT OR IGNORE INTO user_roles (user_id, role_id)
  SELECT u.id, r.id FROM users u, roles r WHERE u.email = '${email}' AND r.key = 'super_admin';
INSERT INTO audit_logs (user_email, action, entity_type, entity_id, details)
  VALUES ('${email}', 'user.bootstrap', 'user', '${email}', '{"role":"super_admin"}');
`;

// Using a SQL file avoids all shell-quoting problems (notably on Windows).
const dir = mkdtempSync(path.join(tmpdir(), "monarch-admin-"));
const file = path.join(dir, "admin.sql");
writeFileSync(file, sql);
const result = spawnSync("npx", ["wrangler", "d1", "execute", "monarch-credentials", target, "--file", `"${file}"`], {
  stdio: "inherit",
  shell: true, // required for npx on Windows
});
rmSync(dir, { recursive: true, force: true });
if (result.status === 0) console.log(`\nSuper Admin ready: ${email}`);
process.exit(result.status ?? 1);
