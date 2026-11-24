// Minimal D1 emulation over node:sqlite so API tests run the real SQL and migrations.
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type Param = string | number | null;

class Stmt {
  private params: Param[] = [];
  constructor(private db: DatabaseSync, readonly sql: string) {}
  bind(...p: Param[]) { this.params = p; return this; }
  private exec() {
    const s = this.db.prepare(this.sql);
    const rows = s.all(...this.params) as Record<string, unknown>[];
    const changes = (this.db.prepare("SELECT changes() AS c").get() as { c: number }).c;
    const hasWrite = /^\s*(insert|update|delete)/i.test(this.sql);
    return { results: rows, success: true, meta: { changes: hasWrite ? changes : 0 } };
  }
  async first<T>() { return (this.exec().results[0] as T | undefined) ?? null; }
  async all<T>() { return this.exec() as unknown as { results: T[] }; }
  async run() { return this.exec(); }
  runSync() { return this.exec(); }
}

export const createTestDb = () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const dir = path.resolve(__dirname, "../../migrations");
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(path.join(dir, f), "utf8"));
  const db = {
    prepare: (sql: string) => new Stmt(sqlite, sql),
    async batch(stmts: Stmt[]) {
      sqlite.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.runSync());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { db: db as unknown as D1Database, sqlite };
};
