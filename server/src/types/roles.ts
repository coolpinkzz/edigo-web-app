/**
 * Role hierarchy for RBAC.
 * SUPER_ADMIN: Cross-tenant, full access.
 * TENANT_ADMIN: Admin within a tenant.
 * STAFF: Can manage students, fees, payments.
 * VIEWER: Read-only access.
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  STAFF: 'STAFF',
  VIEWER: 'VIEWER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Permissions mapped to roles.
 * Lower index = higher privilege.
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.TENANT_ADMIN]: 3,
  [ROLES.STAFF]: 2,
  [ROLES.VIEWER]: 1,
};

/**
 * Check if role A has at least the privileges of role B.
 */
export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
