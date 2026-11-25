#!/usr/bin/env node
// One-command local setup, cross-platform:  npm run setup
//   npm run setup                 -> prompts for the admin email, name and password
//   npm run setup -- --defaults   -> admin@example.com / "Local Admin" / local-dev-password-123 (local use only)
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  console.error(`Node ${process.versions.node} is too old. Install Node 20 or newer (https://nodejs.org) and try again.`);
  process.exit(1);
}
if (!existsSync("node_modules")) {
  console.error("Dependencies are missing. Run `npm install` first.");
  process.exit(1);
}

const step = (title) => console.log(`\n▶ ${title}`);
const run = (args) => {
  const r = spawnSync("npx", args, { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`\nStep failed: npx ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
};

step("Local secrets (.dev.vars)");
if (existsSync(".dev.vars")) console.log("  .dev.vars already exists, leaving it alone.");
else {
  writeFileSync(".dev.vars", `IP_HASH_SALT=${randomBytes(24).toString("hex")}\n`);
  console.log("  Created .dev.vars with a random IP_HASH_SALT.");
}

step("Database migrations (local D1)");
run(["wrangler", "d1", "migrations", "apply", "monarch-credentials", "--local"]);

step("Super Admin account");
const adminArgs = ["scripts/create-admin.mjs", "--local"];
if (process.argv.includes("--defaults")) {
  adminArgs.push("--email", "admin@example.com", "--name", '"Local Admin"', "--password", "local-dev-password-123");
}
const admin = spawnSync("node", adminArgs, { stdio: "inherit", shell: true });
if (admin.status !== 0) process.exit(admin.status ?? 1);

console.log("\n✔ Setup complete. Start the app with:  npm run dev   then open http://localhost:5173");
if (process.argv.includes("--defaults")) console.log("  Sign in at /admin/login with admin@example.com / local-dev-password-123");
