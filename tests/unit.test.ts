import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateCertificateId, normaliseCertificateId, CERTIFICATE_ID_PATTERN } from "../src/worker/lib/ids";
import { hashPassword, verifyPassword, timingSafeEqual } from "../src/worker/lib/crypto";
import { certificateCreateSchema, personName, studentSchema } from "../src/worker/lib/validation";
import { generateCertificatePdf, pdfSafe, type PdfCertificate } from "../src/worker/lib/pdf";
import { qrMatrix } from "../src/worker/lib/qr";
import { ISSUER_LOGOS } from "../src/worker/lib/logos";
import { buildSessionUser, canWriteIssuer, canReadIssuer } from "../src/worker/lib/rbac";

describe("certificate ids", () => {
  it("matches the documented format", () => {
    const id = generateCertificateId("MPS", 2026);
    expect(id).toMatch(/^MPS-2026-[0-9A-Z]{8}$/);
    expect(id).toMatch(CERTIFICATE_ID_PATTERN);
  });
  it("is unique across many draws", () => {
    const set = new Set(Array.from({ length: 20_000 }, () => generateCertificateId("MSI", 2026)));
    expect(set.size).toBe(20_000);
  });
  it("normalises valid input and rejects malformed input", () => {
    const id = generateCertificateId("MPC", 2026);
    expect(normaliseCertificateId(` ${id.toLowerCase()} `)).toBe(id);
    expect(normaliseCertificateId("MPC-2026-ABC")).toBeNull();
    expect(normaliseCertificateId("1; DROP TABLE certificates")).toBeNull();
    expect(normaliseCertificateId("MPC-2026-ILOU0000")).toBeNull(); // excluded alphabet
  });
});

describe("passwords", () => {
  it("hashes with a unique salt and verifies", async () => {
    const a = await hashPassword("a-long-password-123");
    const b = await hashPassword("a-long-password-123");
    expect(a).not.toBe(b);
    expect(a.startsWith("pbkdf2-sha256$100000$")).toBe(true);
    expect(await verifyPassword("a-long-password-123", a)).toBe(true);
    expect(await verifyPassword("wrong-password-123", a)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
  it("compares in constant-time style", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("validation", () => {
  it("accepts real names and rejects markup", () => {
    expect(personName.parse("  Anika   Rao-Menon ")).toBe("Anika Rao-Menon");
    expect(personName.safeParse("<script>alert(1)</script>").success).toBe(false);
    expect(personName.safeParse("A").success).toBe(false);
  });
  it("validates dates and ordering", () => {
    const base = { studentId: 1, typeId: 1, programme: "Full Stack Development" };
    expect(certificateCreateSchema.safeParse({ ...base, startDate: "2026-02-30" }).success).toBe(false);
    expect(certificateCreateSchema.safeParse({ ...base, startDate: "2026-03-01", completionDate: "2026-02-01" }).success).toBe(false);
    expect(certificateCreateSchema.safeParse({ ...base, startDate: "2026-01-01", completionDate: "2026-02-01" }).success).toBe(true);
  });
  it("treats blank optional student fields as absent", () => {
    const r = studentSchema.parse({ fullName: "Ravi Kumar", email: "" });
    expect(r.email).toBeUndefined();
  });
});

describe("rbac", () => {
  const placements = buildSessionUser({ id: 1, email: "a", name: "a" }, [{ key: "placements_admin", name: "P", issuer_id: 1, can_write: 1 }]);
  const viewer = buildSessionUser({ id: 2, email: "b", name: "b" }, [{ key: "viewer", name: "V", issuer_id: null, can_write: 0 }]);
  const sup = buildSessionUser({ id: 3, email: "c", name: "c" }, [{ key: "super_admin", name: "S", issuer_id: null, can_write: 1 }]);
  it("scopes issuer admins to their own issuer", () => {
    expect(canWriteIssuer(placements, 1)).toBe(true);
    expect(canWriteIssuer(placements, 2)).toBe(false);
    expect(canReadIssuer(placements, 2)).toBe(false);
  });
  it("makes viewers read-only everywhere", () => {
    expect(canReadIssuer(viewer, 2)).toBe(true);
    expect(canWriteIssuer(viewer, 1)).toBe(false);
    expect(viewer.canWrite).toBe(false);
  });
  it("gives super admins full access", () => {
    expect(canWriteIssuer(sup, 99)).toBe(true);
  });
});

describe("pdf + qr", () => {
  const base: PdfCertificate = {
    certificateId: "MPS-2026-K7Q4M9XB", studentName: "Anika Rao", title: "Professional Training Certificate",
    programme: "Full Stack Web Development", description: null, startDate: "2026-01-05", completionDate: "2026-04-05",
    issueDate: "2026-04-10", issuerName: "Monarch Placements", issuerSlug: "placements", signatoryName: "A. Signatory",
    signatoryDesignation: "Director", template: "training", verifyUrl: "https://verify.monarchplacements.in/certificate/MPS-2026-K7Q4M9XB",
  };
  it("renders every template to a PDF", async () => {
    for (const template of ["training", "competency", "internship", "project_internship"] as const) {
      const bytes = await generateCertificatePdf({ ...base, template, issuerSlug: template.includes("intern") ? "softwares" : "placements" });
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(2000);
    }
  });
  it("is deterministic for the same certificate", async () => {
    const [a, b] = await Promise.all([generateCertificatePdf(base), generateCertificatePdf(base)]);
    expect(a.length).toBe(b.length);
  });
  it("survives unusual characters and very long names", async () => {
    const bytes = await generateCertificatePdf({ ...base, studentName: "José Ångström " + "Long".repeat(15), programme: "x ".repeat(80) });
    expect(bytes.length).toBeGreaterThan(2000);
    expect(pdfSafe("José “q”")).toBe('Jose "q"');
  });
  it("encodes only the verification URL in the QR", () => {
    const m = qrMatrix(base.verifyUrl);
    expect(m.length).toBeGreaterThan(20);
    expect(m.length).toBe(m[0]!.length);
  });
  it("keeps the PDF wordmark vectors identical to the public logo files", () => {
    for (const [slug, logo] of Object.entries(ISSUER_LOGOS)) {
      const svg = readFileSync(`public/logos/monarch-${slug}.svg`, "utf8");
      expect(svg).toContain(`d="${logo.path}"`);
      expect(svg).toContain(`viewBox="${logo.viewBox.join(" ")}"`);
    }
  });
});
