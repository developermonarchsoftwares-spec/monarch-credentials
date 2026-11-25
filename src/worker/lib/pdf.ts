import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TemplateKey } from "../../shared/types";
import { qrMatrix } from "./qr";

export type PdfCertificate = {
  certificateId: string;
  studentName: string;
  title: string;
  programme: string;
  description: string | null;
  startDate: string | null;
  completionDate: string | null;
  issueDate: string;
  issuerName: string;
  issuerSlug: string;
  signatoryName: string;
  signatoryDesignation: string;
  template: TemplateKey;
  verifyUrl: string;
};

// Monochrome palette (names kept from the original colour theme).
const NAVY = rgb(0x0a / 255, 0x0a / 255, 0x0a / 255);
const BLUE = rgb(0x33 / 255, 0x33 / 255, 0x33 / 255);
const GOLD = rgb(0x9e / 255, 0x9e / 255, 0x9e / 255);
const TEXT = rgb(0x17 / 255, 0x17 / 255, 0x17 / 255);
const MUTED = rgb(0x66 / 255, 0x66 / 255, 0x66 / 255);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

const TEMPLATES: Record<TemplateKey, { label: string; lead: string; connector: string; accent: typeof NAVY }> = {
  training: { label: "CERTIFICATE OF COMPLETION", lead: "has successfully completed the professional training programme", connector: "", accent: NAVY },
  competency: { label: "CERTIFICATE OF COMPETENCY", lead: "has demonstrated competency in", connector: "", accent: BLUE },
  internship: { label: "INTERNSHIP COMPLETION CERTIFICATE", lead: "has successfully completed an internship in", connector: "", accent: NAVY },
  project_internship: { label: "PROJECT INTERNSHIP CERTIFICATE", lead: "has successfully completed a project internship on", connector: "", accent: BLUE },
};

/** Standard PDF fonts only support WinAnsi: fold diacritics and replace anything else. */
export const pdfSafe = (s: string): string =>
  s.normalize("NFD").replace(/\p{M}/gu, "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E]/g, "?");

const formatDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const centered = (page: PDFPage, text: string, y: number, font: PDFFont, size: number, color = TEXT, cx = page.getWidth() / 2) => {
  page.drawText(text, { x: cx - font.widthOfTextAtSize(text, size) / 2, y, size, font, color });
};

const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
};

const fitSize = (text: string, font: PDFFont, max: number, min: number, width: number): number => {
  let size = max;
  while (size > min && font.widthOfTextAtSize(text, size) > width) size -= 1;
  return size;
};

/** Monarch bow-tie "M" mark in a 64x64 box, y-down (same path as /public/logos/*.svg). */
const MONARCH_MARK_PATH =
  "M14.76 14 L32 29.28 L32 35.35 L19.81 25.12 L19.81 40.15 L27.14 34.08 L30.55 36.74 L14.76 50 Z " +
  "M49.24 14 L32 29.28 L32 35.35 L44.19 25.12 L44.19 40.15 L36.86 34.08 L33.45 36.74 L49.24 50 Z";

/** Vector issuer mark (matches /public/logos/*.svg). */
const drawLogo = (page: PDFPage, slug: string, x: number, y: number, size: number) => {
  const fill = slug === "softwares" ? BLACK : NAVY;
  page.drawRectangle({ x, y, width: size, height: size, color: fill });
  // drawSvgPath uses y-down coordinates from its origin, so anchor at the box's top-left.
  page.drawSvgPath(MONARCH_MARK_PATH, { x, y: y + size, scale: size / 64, color: WHITE, borderWidth: 0 });
};

export const generateCertificatePdf = async (cert: PdfCertificate): Promise<Uint8Array> => {
  const tpl = TEMPLATES[cert.template];
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(`${cert.title} - ${cert.studentName}`));
  pdf.setAuthor(pdfSafe(cert.issuerName));
  pdf.setSubject(`Credential ${cert.certificateId}`);
  pdf.setCreator("Monarch Credentials");
  pdf.setProducer("Monarch Credentials");
  // Fixed timestamps keep the output deterministic for a given certificate.
  const stamp = new Date(`${cert.issueDate}T00:00:00Z`);
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);

  const page = pdf.addPage([841.89, 595.28]); // A4 landscape
  const W = page.getWidth();
  const H = page.getHeight();
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifBoldItalic = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);

  // Frame
  page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40, borderColor: tpl.accent, borderWidth: 3 });
  page.drawRectangle({ x: 30, y: 30, width: W - 60, height: H - 60, borderColor: GOLD, borderWidth: 0.8 });
  page.drawRectangle({ x: 20, y: H - 30, width: W - 40, height: 10, color: tpl.accent });

  // Header
  drawLogo(page, cert.issuerSlug, 60, H - 112, 44);
  page.drawText(pdfSafe(cert.issuerName).toUpperCase(), { x: 112, y: H - 84, size: 15, font: sansBold, color: NAVY });
  page.drawText("MONARCH CREDENTIALS", { x: 112, y: H - 100, size: 8, font: sans, color: MUTED });

  centered(page, tpl.label, H - 150, sansBold, 12, tpl.accent);
  page.drawLine({ start: { x: W / 2 - 40, y: H - 160 }, end: { x: W / 2 + 40, y: H - 160 }, thickness: 1.2, color: GOLD });

  centered(page, "This is to certify that", H - 192, serif, 14, MUTED);
  const name = pdfSafe(cert.studentName);
  centered(page, name, H - 235, serifBoldItalic, fitSize(name, serifBoldItalic, 38, 20, W - 200), NAVY);
  page.drawLine({ start: { x: W / 2 - 170, y: H - 246 }, end: { x: W / 2 + 170, y: H - 246 }, thickness: 0.6, color: GOLD });

  // Lead + programme
  let y = H - 272;
  for (const line of wrap(tpl.lead, serif, 14, W - 260)) {
    centered(page, line, y, serif, 14, TEXT);
    y -= 19;
  }
  y -= 6;
  const programme = pdfSafe(cert.programme);
  for (const line of wrap(programme, sansBold, 18, W - 240).slice(0, 2)) {
    centered(page, line, y, sansBold, 18, NAVY);
    y -= 24;
  }
  const duration =
    cert.startDate && cert.completionDate
      ? `${formatDate(cert.startDate)} to ${formatDate(cert.completionDate)}`
      : cert.completionDate
        ? `Completed on ${formatDate(cert.completionDate)}`
        : "";
  if (duration) {
    y -= 2;
    centered(page, `Duration: ${duration}`, y, sans, 11, MUTED);
  }

  // Footer: signatory / issue date / QR
  const baseY = 92;
  page.drawLine({ start: { x: 75, y: baseY + 38 }, end: { x: 255, y: baseY + 38 }, thickness: 0.7, color: TEXT });
  page.drawText(pdfSafe(cert.signatoryName), { x: 75, y: baseY + 24, size: 11, font: sansBold, color: NAVY });
  page.drawText(pdfSafe(cert.signatoryDesignation), { x: 75, y: baseY + 11, size: 9, font: sans, color: MUTED });
  page.drawText(pdfSafe(cert.issuerName), { x: 75, y: baseY - 1, size: 9, font: sans, color: MUTED });

  centered(page, formatDate(cert.issueDate), baseY + 42, sansBold, 11, NAVY, W / 2 - 20);
  page.drawLine({ start: { x: W / 2 - 110, y: baseY + 38 }, end: { x: W / 2 + 70, y: baseY + 38 }, thickness: 0.7, color: TEXT });
  centered(page, "Date of issue", baseY + 24, sans, 9, MUTED, W / 2 - 20);
  centered(page, `Credential ID: ${cert.certificateId}`, baseY + 8, sansBold, 9, NAVY, W / 2 - 20);

  // QR code (verification URL only: no personal data)
  const matrix = qrMatrix(cert.verifyUrl);
  const qrSize = 84;
  const cell = qrSize / matrix.length;
  const qx = W - 75 - qrSize;
  const qy = baseY - 4;
  page.drawRectangle({ x: qx - 6, y: qy - 6, width: qrSize + 12, height: qrSize + 12, color: WHITE, borderColor: GOLD, borderWidth: 0.6 });
  matrix.forEach((row, r) =>
    row.forEach((dark, col) => {
      if (dark) page.drawRectangle({ x: qx + col * cell, y: qy + qrSize - (r + 1) * cell, width: cell + 0.15, height: cell + 0.15, color: NAVY });
    }),
  );
  centered(page, "Scan to verify", qy - 18, sansBold, 8, NAVY, qx + qrSize / 2);

  const urlText = cert.verifyUrl.replace(/^https?:\/\//, "");
  centered(page, `Verify this credential at ${urlText}`, 44, sans, 8.5, MUTED);

  return pdf.save();
};
