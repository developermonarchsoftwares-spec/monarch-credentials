import { beforeEach, describe, expect, it } from "vitest";
import { createHarness, PASSWORD } from "./helpers/app";

type H = Awaited<ReturnType<typeof createHarness>>;
let h: H;
beforeEach(async () => { h = await createHarness(); });

const json = async <T = any>(r: Response) => (await r.json()) as T;
const configureSignatories = (hh: H) =>
  hh.sqlite.exec("UPDATE issuers SET signatory_name='A. Signatory', signatory_designation='Director'");

const makeStudent = async (s: any, name = "Anika Rao", email = "anika@example.com") => {
  const res = await h.api(s, "POST", "/students", { fullName: name, email, phone: "+91 98765 43210" });
  expect(res.status).toBe(201);
  return (await json(res)).id as number;
};
const typeId = (code: string) => (h.sqlite.prepare("SELECT id FROM certificate_types WHERE code=?").get(code) as { id: number }).id;
const issue = async (s: any, studentId: number, code = "MPS", publish = true) => {
  const res = await h.api(s, "POST", "/certificates", { studentId, typeId: typeId(code), programme: "Full Stack Web Development", startDate: "2026-01-05", completionDate: "2026-04-05" });
  expect(res.status).toBe(201);
  const { certificateId } = await json(res);
  if (publish) expect((await h.api(s, "POST", `/certificates/${certificateId}/publish`, {})).status).toBe(200);
  return certificateId as string;
};

describe("authentication", () => {
  it("rejects unauthenticated admin access", async () => {
    expect((await h.call("/api/admin/stats")).status).toBe(401);
    expect((await h.call("/api/admin/certificates", { method: "POST", body: "{}" })).status).toBe(401);
  });
  it("rejects bad credentials with a generic message and logs the attempt", async () => {
    const res = await h.call("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@test.in", password: "nope-nope-nope" }) });
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe("Incorrect email or password");
    const unknown = await h.call("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "ghost@test.in", password: PASSWORD }) });
    expect(unknown.status).toBe(401);
    expect(h.sqlite.prepare("SELECT COUNT(*) c FROM audit_logs WHERE action='auth.login_failed'").get()).toEqual({ c: 2 });
  });
  it("sets a hardened session cookie and never stores the raw token", async () => {
    const res = await h.call("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@test.in", password: PASSWORD }) });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    const token = cookie.split(";")[0]!.split("=")[1]!;
    const stored = h.sqlite.prepare("SELECT token_hash FROM sessions").get() as { token_hash: string };
    expect(stored.token_hash).not.toBe(token);
  });
  it("requires a CSRF token and same-origin for mutations", async () => {
    const s = await h.login("super@test.in");
    const noCsrf = await h.call("/api/admin/students", { method: "POST", headers: { cookie: s.cookie, "content-type": "application/json" }, body: JSON.stringify({ fullName: "Ravi Kumar" }) });
    expect(noCsrf.status).toBe(403);
    const crossOrigin = await h.api(s, "POST", "/students", { fullName: "Ravi Kumar" }, { origin: "https://evil.example" });
    expect(crossOrigin.status).toBe(403);
  });
  it("logs out and invalidates the session", async () => {
    const s = await h.login("super@test.in");
    expect((await h.api(s, "POST", "/../auth/logout".replace("/../auth", ""))).status).toBe(404); // sanity: not an admin route
    const out = await h.call("/api/auth/logout", { method: "POST", headers: { cookie: s.cookie, "x-csrf-token": s.csrf } });
    expect(out.status).toBe(200);
    expect((await h.call("/api/admin/stats", { headers: { cookie: s.cookie } })).status).toBe(401);
  });
  it("rate limits repeated failed logins", async () => {
    let last = 0;
    for (let i = 0; i < 10; i++) {
      const r = await h.call("/api/auth/login", { method: "POST", ip: "9.9.9.9", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "super@test.in", password: "bad-password-1" }) });
      last = r.status;
    }
    expect(last).toBe(429);
  });
  it("deactivated users lose access immediately", async () => {
    const s = await h.login("viewer@test.in");
    h.sqlite.exec("UPDATE users SET is_active=0 WHERE email='viewer@test.in'");
    expect((await h.call("/api/admin/stats", { headers: { cookie: s.cookie } })).status).toBe(401);
  });
});

describe("issuance lifecycle", () => {
  it("creates a draft that is invisible publicly, then publishes and verifies", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const sid = await makeStudent(s);
    const id = await issue(s, sid, "MPS", false);
    expect(id).toMatch(/^MPS-\d{4}-[0-9A-Z]{8}$/);
    expect((await h.call(`/api/public/certificates/${id}`)).status).toBe(404);

    const pub = await h.api(s, "POST", `/certificates/${id}/publish`, {});
    expect(pub.status).toBe(200);
    const res = await h.call(`/api/public/certificates/${id}`);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.certificate.status).toBe("valid");
    expect(body.certificate.studentName).toBe("Anika Rao");
    expect(body.certificate.issuerName).toBe("Monarch Placements");
    expect(body.certificate.verifyUrl).toBe(`https://verify.monarchplacements.in/certificate/${id}`);
  });
  it("never exposes private student data publicly", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const id = await issue(s, await makeStudent(s));
    const text = await (await h.call(`/api/public/certificates/${id}`)).text();
    for (const secret of ["anika@example.com", "98765", "phone", "email", "notes", "student_id", "created_by"]) expect(text.toLowerCase()).not.toContain(secret.toLowerCase());
    const search = await (await h.call("/api/public/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Anika Rao", issuer: "placements" }) })).text();
    expect(search).not.toContain("anika@example.com");
  });
  it("blocks publishing until the issuer signatory is configured", async () => {
    const s = await h.login("super@test.in");
    const id = await issue(s, await makeStudent(s), "MPS", false);
    const res = await h.api(s, "POST", `/certificates/${id}/publish`, {});
    expect(res.status).toBe(422);
    expect((await json(res)).code).toBe("signatory_missing");
  });
  it("makes published credentials immutable and publish idempotent-safe", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const id = await issue(s, await makeStudent(s));
    const edit = await h.api(s, "PUT", `/certificates/${id}`, { title: "Changed title", programme: "Other" });
    expect(edit.status).toBe(409);
    expect((await h.api(s, "POST", `/certificates/${id}/publish`, {})).status).toBe(409);
    expect((await h.api(s, "DELETE", `/certificates/${id}`)).status).toBe(409);
  });
  it("revokes with a reason, shows revoked publicly and blocks PDF download", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const id = await issue(s, await makeStudent(s));
    expect((await h.api(s, "POST", `/certificates/${id}/revoke`, { reason: "x" })).status).toBe(400);
    expect((await h.api(s, "POST", `/certificates/${id}/revoke`, { reason: "Issued in error" })).status).toBe(200);
    expect((await h.api(s, "POST", `/certificates/${id}/revoke`, { reason: "Issued in error" })).status).toBe(409);
    const body = await json(await h.call(`/api/public/certificates/${id}`));
    expect(body.certificate.status).toBe("revoked");
    expect((await h.call(`/api/public/certificates/${id}/pdf`)).status).toBe(410);
  });
  it("serves a real PDF for valid credentials and records the file", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const id = await issue(s, await makeStudent(s), "MSI");
    const res = await h.call(`/api/public/certificates/${id}/pdf`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    await h.call(`/api/public/certificates/${id}/pdf`);
    expect(h.sqlite.prepare("SELECT COUNT(*) c FROM certificate_files").get()).toEqual({ c: 1 }); // identical output is recorded once
  });
  it("writes audit entries for create, publish and revoke", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const id = await issue(s, await makeStudent(s));
    await h.api(s, "POST", `/certificates/${id}/revoke`, { reason: "Duplicate record" });
    const actions = (h.sqlite.prepare("SELECT action FROM audit_logs WHERE entity_id=? ORDER BY id").all(id) as { action: string }[]).map((r) => r.action);
    expect(actions).toEqual(["certificate.create", "certificate.publish", "certificate.revoke"]);
    const detail = await json(await h.api(s, "GET", `/certificates/${id}`));
    expect(detail.history.length).toBe(3);
  });
  it("enforces DB-level uniqueness of certificate ids", () => {
    h.sqlite.exec("INSERT INTO students (full_name,name_key) VALUES ('A B','a b')");
    const ins = () => h.sqlite.exec("INSERT INTO certificates (certificate_id,student_id,issuer_id,type_id,title,programme) VALUES ('MPS-2026-AAAAAAAA',1,1,1,'t','p')");
    ins();
    expect(ins).toThrow(/UNIQUE/);
  });
});

describe("role-based access control", () => {
  it("prevents one issuer's admin from issuing or touching the other's credentials", async () => {
    const sup = await h.login("super@test.in");
    const pl = await h.login("placements@test.in");
    configureSignatories(h);
    const sid = await makeStudent(sup);
    const forbidden = await h.api(pl, "POST", "/certificates", { studentId: sid, typeId: typeId("MSI"), programme: "AI/ML Internship" });
    expect(forbidden.status).toBe(403);

    const softwaresCert = await issue(sup, sid, "MSI");
    expect((await h.api(pl, "POST", `/certificates/${softwaresCert}/revoke`, { reason: "attempted cross-issuer" })).status).toBe(404);
    const list = await json(await h.api(pl, "GET", "/certificates"));
    expect(list.items.length).toBe(0);
    expect((await h.api(pl, "GET", `/certificates/${softwaresCert}`)).status).toBe(404);

    const own = await issue(pl, sid, "MPC");
    expect((await json(await h.api(pl, "GET", "/certificates"))).items.map((i: any) => i.certificateId)).toEqual([own]);
    const types = await json(await h.api(pl, "GET", "/certificates/types"));
    expect(types.types.every((t: any) => t.issuerSlug === "placements")).toBe(true);
  });
  it("makes viewers read-only but able to read everything", async () => {
    const sup = await h.login("super@test.in");
    const vw = await h.login("viewer@test.in");
    configureSignatories(h);
    const sid = await makeStudent(sup);
    const id = await issue(sup, sid, "MPI");
    expect((await h.api(vw, "GET", `/certificates/${id}`)).status).toBe(200);
    expect((await h.api(vw, "POST", "/students", { fullName: "New Person" })).status).toBe(403);
    expect((await h.api(vw, "POST", `/certificates/${id}/revoke`, { reason: "should not work" })).status).toBe(403);
    expect((await h.api(vw, "PUT", "/issuers/placements", {})).status).toBe(403);
  });
  it("restricts user management and audit log to super admins", async () => {
    const pl = await h.login("placements@test.in");
    expect((await h.api(pl, "GET", "/users")).status).toBe(403);
    expect((await h.api(pl, "GET", "/audit")).status).toBe(403);
    const sup = await h.login("super@test.in");
    expect((await h.api(sup, "GET", "/users")).status).toBe(200);
    const users = await json(await h.api(sup, "GET", "/users"));
    expect(JSON.stringify(users)).not.toMatch(/pbkdf2/);
  });
  it("lets an issuer admin edit only their own issuer profile", async () => {
    const pl = await h.login("placements@test.in");
    const body = { tagline: "t", description: "d", website: "https://monarchplacements.in", contactEmail: "", contactPhone: "", address: "", signatoryName: "S. Name", signatoryDesignation: "Director" };
    expect((await h.api(pl, "PUT", "/issuers/placements", body)).status).toBe(200);
    expect((await h.api(pl, "PUT", "/issuers/softwares", body)).status).toBe(404);
    expect((await h.api(pl, "PUT", "/issuers/placements", { ...body, website: "http://insecure.example" })).status).toBe(400);
  });
  it("keeps at least one active super admin", async () => {
    const sup = await h.login("super@test.in");
    const me = h.sqlite.prepare("SELECT id FROM users WHERE email='super@test.in'").get() as { id: number };
    expect((await h.api(sup, "PUT", `/users/${me.id}`, { role: "viewer" })).status).toBe(409);
    expect((await h.api(sup, "PUT", `/users/${me.id}`, { isActive: false })).status).toBe(409);
  });
  it("creates users with hashed passwords and enforces minimum length", async () => {
    const sup = await h.login("super@test.in");
    expect((await h.api(sup, "POST", "/users", { email: "n@test.in", name: "New Admin", password: "short", role: "viewer" })).status).toBe(400);
    expect((await h.api(sup, "POST", "/users", { email: "n@test.in", name: "New Admin", password: "a-sufficiently-long-pw", role: "viewer" })).status).toBe(201);
    expect((await h.api(sup, "POST", "/users", { email: "n@test.in", name: "New Admin", password: "a-sufficiently-long-pw", role: "viewer" })).status).toBe(409);
    const row = h.sqlite.prepare("SELECT password_hash h FROM users WHERE email='n@test.in'").get() as { h: string };
    expect(row.h).toMatch(/^pbkdf2-sha256\$/);
    expect(await h.login("n@test.in", "a-sufficiently-long-pw")).toBeTruthy();
  });
});

describe("students", () => {
  it("prevents duplicate students by email and flags same-name records", async () => {
    const s = await h.login("super@test.in");
    await makeStudent(s, "Anika Rao", "anika@example.com");
    const dupEmail = await h.api(s, "POST", "/students", { fullName: "Someone Else", email: "ANIKA@example.com" });
    expect(dupEmail.status).toBe(409);
    expect((await json(dupEmail)).code).toBe("duplicate_email");
    const dupName = await h.api(s, "POST", "/students", { fullName: "anika  rao", email: "other@example.com" });
    expect(dupName.status).toBe(409);
    expect((await json(dupName)).code).toBe("possible_duplicate");
    const forced = await h.api(s, "POST", "/students", { fullName: "anika  rao", email: "other@example.com", confirmDuplicate: true });
    expect(forced.status).toBe(201);
  });
  it("searches, paginates and refuses to delete students with certificates", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const sid = await makeStudent(s, "Anika Rao", "a@example.com");
    for (let i = 0; i < 6; i++) await makeStudent(s, `Learner Number${"abcdef"[i]}`, `l${i}@example.com`);
    const page = await json(await h.api(s, "GET", "/students?pageSize=5&page=2"));
    expect(page.items.length).toBe(2);
    expect(page.total).toBe(7);
    expect((await json(await h.api(s, "GET", "/students?q=anika"))).items.length).toBe(1);
    expect((await json(await h.api(s, "GET", "/students?q=%25"))).items.length).toBe(0); // wildcard is escaped
    await issue(s, sid);
    expect((await h.api(s, "DELETE", `/students/${sid}`)).status).toBe(409);
  });
  it("rejects malformed student input", async () => {
    const s = await h.login("super@test.in");
    expect((await h.api(s, "POST", "/students", { fullName: "<img src=x onerror=alert(1)>" })).status).toBe(400);
    expect((await h.api(s, "POST", "/students", { fullName: "Valid Name", email: "not-an-email" })).status).toBe(400);
  });
});

describe("public verification", () => {
  it("handles malformed and unknown ids", async () => {
    expect((await h.call("/api/public/certificates/not-an-id")).status).toBe(400);
    expect((await h.call("/api/public/certificates/MPS-2026-ZZZZZZZZ")).status).toBe(404);
    expect((await h.call("/api/public/certificates/'%20OR%201=1--")).status).toBe(400);
  });
  it("rate limits repeated lookups from one address", async () => {
    let last = 0;
    for (let i = 0; i < 65; i++) last = (await h.call("/api/public/certificates/MPS-2026-ZZZZZZZZ", { ip: "7.7.7.7" })).status;
    expect(last).toBe(429);
  });
  it("records verification events without storing raw IPs", async () => {
    await h.call("/api/public/certificates/MPS-2026-ZZZZZZZZ", { ip: "5.5.5.5" });
    const ev = h.sqlite.prepare("SELECT result, ip_hash FROM verification_events").get() as { result: string; ip_hash: string };
    expect(ev.result).toBe("not_found");
    expect(ev.ip_hash).not.toContain("5.5.5.5");
  });
  it("name search needs a full name, masks output and is scoped to the issuer", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    await issue(s, await makeStudent(s, "Anika Rao", "a@example.com"));
    const search = (body: unknown) => h.call("/api/public/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    expect((await search({ name: "Anika", issuer: "placements" })).status).toBe(400);
    const hit = await json(await search({ name: "anika rao", issuer: "placements" }));
    expect(hit.results.length).toBe(1);
    expect(hit.results[0].maskedName).toBe("A•••• R••");
    expect(JSON.stringify(hit)).not.toContain("Anika Rao");
    expect((await json(await search({ name: "Anika Rao", issuer: "softwares" }))).results.length).toBe(0);
    expect((await json(await search({ name: "Anika Ra", issuer: "placements" }))).results.length).toBe(0); // exact only
  });
  it("sets security headers and disables caching on credential responses", async () => {
    const res = await h.call("/api/public/certificates/MPS-2026-ZZZZZZZZ");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});

describe("dashboard", () => {
  it("reports real database values scoped to the viewer's issuers", async () => {
    const sup = await h.login("super@test.in");
    const pl = await h.login("placements@test.in");
    configureSignatories(h);
    const sid = await makeStudent(sup);
    const a = await issue(sup, sid, "MPS");
    await issue(sup, sid, "MSI");
    await issue(sup, sid, "MPI", false);
    await h.api(sup, "POST", `/certificates/${a}/revoke`, { reason: "Test revocation" });
    await h.call(`/api/public/certificates/${a}`);
    const all = await json(await h.api(sup, "GET", "/stats"));
    expect(all.totals).toMatchObject({ certificates: 3, valid: 1, revoked: 1, drafts: 1, students: 1, issuedThisMonth: 2 });
    expect(all.totals.verifications).toBe(1);
    expect(all.issuedByMonth).toHaveLength(6);
    expect(all.verificationsByDay).toHaveLength(14);
    const scoped = await json(await h.api(pl, "GET", "/stats"));
    expect(scoped.totals).toMatchObject({ certificates: 1, revoked: 1, valid: 0 });
  });
  it("sorts and filters certificate lists safely", async () => {
    const s = await h.login("super@test.in");
    configureSignatories(h);
    const sid = await makeStudent(s);
    await issue(s, sid, "MPS");
    await issue(s, sid, "MSI", false);
    expect((await json(await h.api(s, "GET", "/certificates?status=draft"))).items.length).toBe(1);
    expect((await json(await h.api(s, "GET", "/certificates?q=anika&sort=student&dir=asc"))).items.length).toBe(2);
    expect((await h.api(s, "GET", "/certificates?sort=password_hash")).status).toBe(400);
  });
});
