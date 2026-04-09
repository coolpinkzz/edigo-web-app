import { STORAGE_ACCESS_TOKEN } from "../constants";

/** Clears the stored JWT (call before navigating to `/login`). */
export function clearAccessToken(): void {
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
}

const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 4,
  TENANT_ADMIN: 3,
  STAFF: 2,
  VIEWER: 1,
};

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Role from JWT in localStorage (for UI gating; server enforces RBAC). */
export function getRoleFromStorage(): string | null {
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) return null;
  const p = parseJwtPayload(token);
  const role = p?.role;
  return typeof role === "string" ? role : null;
}

/** Phone (E.164) from JWT (for account UI). */
export function getPhoneFromStorage(): string | null {
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) return null;
  const p = parseJwtPayload(token);
  const phone = p?.phone;
  return typeof phone === "string" ? phone : null;
}

/** Display name from JWT (`name` claim; absent on older tokens). */
export function getNameFromStorage(): string | null {
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) return null;
  const p = parseJwtPayload(token);
  const name = p?.name;
  return typeof name === "string" && name.trim() !== "" ? name : null;
}

const ROLE_DISPLAY_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  TENANT_ADMIN: "Tenant admin",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

/** Human-readable role label for UI (falls back to raw role string). */
export function getRoleDisplayLabel(role: string | null): string {
  if (!role) return "";
  return ROLE_DISPLAY_LABELS[role] ?? role;
}

/** Current user id from JWT (`userId` claim). */
export function getUserIdFromStorage(): string | null {
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  if (!token) return null;
  const p = parseJwtPayload(token);
  const id = p?.userId;
  return typeof id === "string" ? id : null;
}

/** STAFF and above (matches server `requireRole(ROLES.STAFF)`). */
export function hasStaffAccess(role: string | null): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK.STAFF;
}

/**
 * Tenant admin or super admin — team / org settings (matches server
 * `requireRole(ROLES.TENANT_ADMIN)` for admin-only screens).
 */
export function hasTenantAdminAccess(role: string | null): boolean {
  if (!role) return false;
  const r = ROLE_RANK[role] ?? 0;
  return r >= ROLE_RANK.TENANT_ADMIN;
}

/** Fee-related UI (overview, overdue, templates): tenant admin and super admin only. */
export function hasFeeFeatureAccess(role: string | null): boolean {
  if (!role) return false;
  return role === "SUPER_ADMIN" || role === "TENANT_ADMIN";
}

export function isStaffRole(role: string | null): boolean {
  return role === "STAFF";
}
