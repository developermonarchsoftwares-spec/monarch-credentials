#!/usr/bin/env node
// Creates the first Super Admin. Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='long passphrase' \
//     node scripts/create-admin.mjs [--remote | --local]
// The password is hashed here (PBKDF2-SHA256, 100k iterations: the Workers maximum) and only the hash is sent to D1.
import { webcrypto as crypto } from "node:crypto";
import { spawnSync } from "node:child_process";

const { ADMIN_EMAIL: email, ADMIN_NAME: name, ADMIN_PASSWORD: password } = process.env;
const target = process.argv.includes("--remote") ? "--remote" : "--local";
if (!email || !name || !password) {
  console.error("Set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD.");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}
if (!/^[^@\s'"]+@[^@\s'"]+\.[^@\s'"]+$/.test(email) || /['"\\;]/.test(name)) {
  console.error("Invalid email or name (quotes, backslashes and semicolons are not allowed).");
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = new Uint8Array(
  await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 100000 }, key, 256),
);
const b64 = (u) => Buffer.from(u).toString("base64");
const hash = `pbkdf2-sha256$100000$${b64(salt)}$${b64(bits)}`;
const e = email.toLowerCase();

const sql = [
  `INSERT INTO users (email, name, password_hash) VALUES ('${e}', '${name}', '${hash}');`,
  `INSERT INTO user_roles (user_id, role_id) VALUES (last_insert_rowid(), (SELECT id FROM roles WHERE key = 'super_admin'));`,
  `INSERT INTO audit_logs (user_email, action, entity_type, entity_id, details) VALUES ('${e}', 'user.bootstrap', 'user', '${e}', '{"role":"super_admin"}');`,
].join(" ");

const r = spawnSync("npx", ["wrangler", "d1", "execute", "monarch-credentials", target, "--command", sql], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
