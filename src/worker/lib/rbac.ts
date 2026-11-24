import type { RoleKey, SessionUser } from "../../shared/types";

export type RoleRow = { key: RoleKey; name: string; issuer_id: number | null; can_write: number };

export const buildSessionUser = (
  user: { id: number; email: string; name: string },
  roleRows: RoleRow[],
): SessionUser => {
  const roles = roleRows.map((r) => ({
    key: r.key,
    name: r.name,
    issuerId: r.issuer_id,
    canWrite: r.can_write === 1,
  }));
  const isSuperAdmin = roles.some((r) => r.key === "super_admin");
  const readsAll = isSuperAdmin || roles.some((r) => r.key === "viewer");
  const writable = roles.filter((r) => r.canWrite && r.issuerId !== null).map((r) => r.issuerId as number);
  const readable = [...new Set([...writable])];
  return {
    ...user,
    roles,
    isSuperAdmin,
    canWrite: isSuperAdmin || writable.length > 0,
    writableIssuerIds: isSuperAdmin ? "all" : writable,
    readableIssuerIds: readsAll ? "all" : readable,
  };
};

export const canReadIssuer = (u: SessionUser, issuerId: number): boolean =>
  u.readableIssuerIds === "all" || u.readableIssuerIds.includes(issuerId);

export const canWriteIssuer = (u: SessionUser, issuerId: number): boolean =>
  u.writableIssuerIds === "all" || u.writableIssuerIds.includes(issuerId);

/**
 * SQL fragment restricting a query to the issuers a user may read.
 * Returns [clause, params]. `col` must be a trusted column name, never user input.
 */
export const issuerScope = (u: SessionUser, col: string): [string, number[]] => {
  if (u.readableIssuerIds === "all") return ["1=1", []];
  if (u.readableIssuerIds.length === 0) return ["1=0", []];
  return [`${col} IN (${u.readableIssuerIds.map(() => "?").join(",")})`, [...u.readableIssuerIds]];
};
