// Types shared between the Worker API and the web client.
export type CertificateStatus = "draft" | "valid" | "revoked";
export type RoleKey = "super_admin" | "placements_admin" | "softwares_admin" | "viewer";
export type TemplateKey = "training" | "competency" | "internship" | "project_internship";

export type PublicIssuer = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logoPath: string | null;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
};

/** Only what is needed to authenticate a credential. No contact details, no internal IDs. */
export type PublicCertificate = {
  certificateId: string;
  status: "valid" | "revoked";
  studentName: string;
  title: string;
  programme: string;
  description: string | null;
  issuerName: string;
  issuerSlug: string;
  issuerLogoPath: string | null;
  issueDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  verifyUrl: string;
};

export type SearchResult = {
  certificateId: string;
  maskedName: string;
  title: string;
  programme: string;
  issuerName: string;
  issueDate: string | null;
  status: "valid" | "revoked";
};

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  roles: { key: RoleKey; name: string; issuerId: number | null; canWrite: boolean }[];
  /** Convenience flags computed server-side from roles. */
  isSuperAdmin: boolean;
  canWrite: boolean;
  /** Issuer ids this user can write to ("all" for super admin). */
  writableIssuerIds: number[] | "all";
  /** Issuer ids this user can read ("all" for super admin / viewer). */
  readableIssuerIds: number[] | "all";
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: "Super Admin",
  placements_admin: "Placements Admin",
  softwares_admin: "Softwares Admin",
  viewer: "Viewer",
};
