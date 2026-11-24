import { z } from "zod";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}, "Invalid date");
const optionalText = (max: number) =>
  z.string().trim().max(max).transform((s) => (s === "" ? null : s)).nullable().optional();

export const nameKey = (name: string) => collapse(name).toLowerCase();

export const personName = z
  .string()
  .transform(collapse)
  .pipe(
    z.string().min(2, "Name is too short").max(80, "Name is too long")
      .regex(/^[\p{L}][\p{L}\p{M}.'’\- ]*$/u, "Use letters, spaces, apostrophes, hyphens and full stops only"),
  );

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(256),
});

export const passwordSchema = z.string().min(12, "Use at least 12 characters").max(256);

export const studentSchema = z.object({
  fullName: personName,
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(30).regex(/^[0-9+()\-\s]*$/, "Invalid phone number").optional(),
  notes: z.string().trim().max(1000).optional(),
  /** Set true after the admin has reviewed possible duplicates. */
  confirmDuplicate: z.boolean().optional(),
});

export const certificateCreateSchema = z
  .object({
    studentId: z.number().int().positive(),
    typeId: z.number().int().positive(),
    title: z.string().transform(collapse).pipe(z.string().min(3).max(120)).optional(),
    programme: z.string().transform(collapse).pipe(z.string().min(3, "Programme is required").max(160)),
    description: optionalText(400),
    startDate: isoDate.nullable().optional(),
    completionDate: isoDate.nullable().optional(),
  })
  .refine((v) => !v.startDate || !v.completionDate || v.startDate <= v.completionDate, {
    message: "Completion date must be on or after the start date",
    path: ["completionDate"],
  });

export const certificateUpdateSchema = z
  .object({
    title: z.string().transform(collapse).pipe(z.string().min(3).max(120)),
    programme: z.string().transform(collapse).pipe(z.string().min(3).max(160)),
    description: optionalText(400),
    startDate: isoDate.nullable().optional(),
    completionDate: isoDate.nullable().optional(),
  })
  .refine((v) => !v.startDate || !v.completionDate || v.startDate <= v.completionDate, {
    message: "Completion date must be on or after the start date",
    path: ["completionDate"],
  });

export const publishSchema = z.object({ issueDate: isoDate.optional() });
export const revokeSchema = z.object({ reason: z.string().transform(collapse).pipe(z.string().min(5, "Give a reason").max(300)) });

export const issuerUpdateSchema = z.object({
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(800),
  website: z.string().trim().url().startsWith("https://").max(200).nullable().or(z.literal("").transform(() => null)),
  contactEmail: z.string().trim().email().max(254).nullable().or(z.literal("").transform(() => null)),
  contactPhone: z.string().trim().max(30).nullable().or(z.literal("").transform(() => null)),
  address: z.string().trim().max(300).nullable().or(z.literal("").transform(() => null)),
  signatoryName: z.string().transform(collapse).pipe(z.string().max(80)).nullable().or(z.literal("").transform(() => null)),
  signatoryDesignation: z.string().transform(collapse).pipe(z.string().max(80)).nullable().or(z.literal("").transform(() => null)),
});

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: personName,
  password: passwordSchema,
  role: z.enum(["super_admin", "placements_admin", "softwares_admin", "viewer"]),
});
export const userUpdateSchema = z.object({
  name: personName.optional(),
  role: z.enum(["super_admin", "placements_admin", "softwares_admin", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export const searchByNameSchema = z.object({
  name: z.string().transform(collapse).pipe(z.string().min(5).max(80)),
  issuer: z.enum(["placements", "softwares"]),
});

export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
