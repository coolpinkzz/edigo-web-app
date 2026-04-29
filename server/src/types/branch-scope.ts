import { JwtPayload } from "./express";
import { ROLES, Role } from "./roles";

/**
 * Whether list/aggregate queries should filter by branch_id.
 * - `none`: entire tenant (no branch field in filter).
 * - `in`: restrict to documents whose branchId is in the list.
 */
export type BranchScope = { kind: "none" } | { kind: "in"; ids: string[] };

export class BranchAccessError extends Error {
  constructor(message = "Branch access denied") {
    super(message);
    this.name = "BranchAccessError";
  }
}

/**
 * Non-empty branchIds on the JWT mean the user is restricted to those branches (STAFF / scoped admin).
 * Empty or missing branchIds => full access within the tenant.
 */
export function getJwtRestrictedBranchIds(user: JwtPayload): string[] | null {
  const ids = user.branchIds?.filter(
    (id) => typeof id === "string" && id.length === 24,
  );
  if (!ids?.length) {
    return null;
  }
  return ids;
}

/**
 * Resolves branch filter for list/dashboard APIs.
 * Optional `queryBranchId` narrows to one branch (must be allowed for restricted users).
 */
export function resolveBranchScopeFromRequest(
  user: JwtPayload,
  queryBranchId?: string,
): BranchScope {
  const restricted = getJwtRestrictedBranchIds(user);
  const q = queryBranchId?.trim();

  if (restricted) {
    if (q) {
      if (!restricted.includes(q)) {
        throw new BranchAccessError();
      }
      return { kind: "in", ids: [q] };
    }
    return { kind: "in", ids: restricted };
  }

  if (q) {
    return { kind: "in", ids: [q] };
  }
  return { kind: "none" };
}

/** Merges branch scope into a flat Mongo filter for a `branchId` field (string | null). */
export function mergeBranchScopeOnQuery<T extends Record<string, unknown>>(
  base: T,
  scope: BranchScope,
): T & Record<string, unknown> {
  if (scope.kind === "none") {
    return { ...base };
  }
  return { ...base, branchId: { $in: scope.ids } };
}

/**
 * Single-document check: restricted users may only access rows for an allowed branch.
 * Missing / null branchId on legacy rows is only visible when user is not branch-restricted.
 */
export function assertDocumentBranchAccess(
  user: JwtPayload,
  documentBranchId: string | null | undefined,
): void {
  const restricted = getJwtRestrictedBranchIds(user);
  if (!restricted) {
    return;
  }
  if (
    documentBranchId &&
    restricted.includes(documentBranchId)
  ) {
    return;
  }
  throw new BranchAccessError();
}

/** Super-admins are not branch-restricted by tenant RBAC. */
export function roleIgnoresBranchRestriction(role: Role): boolean {
  return role === ROLES.SUPER_ADMIN;
}
