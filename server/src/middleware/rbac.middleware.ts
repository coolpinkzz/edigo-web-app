import { Request, Response, NextFunction } from 'express';
import { hasMinRole, Role, ROLES } from '../types/roles';

/**
 * Requires req.user to exist (use after authenticate middleware).
 * Ensures user has at least the specified role.
 */
export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasMinRole(req.user.role as Role, minRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Restricts access to SUPER_ADMIN only (cross-tenant operations).
 */
export const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN);

/**
 * Restricts access to tenant admins and above.
 */
export const requireTenantAdmin = requireRole(ROLES.TENANT_ADMIN);

/**
 * Restricts access to staff and above (excludes VIEWER).
 */
export const requireStaff = requireRole(ROLES.STAFF);

/**
 * Ensures user can only access resources belonging to their tenant.
 * Use when req.params or req.body contains tenantId.
 */
export function requireSameTenant(paramKey: string = 'tenantId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // SUPER_ADMIN can access any tenant
    if (req.user.role === ROLES.SUPER_ADMIN) {
      next();
      return;
    }

    const targetTenantId = req.params[paramKey] ?? req.body[paramKey];
    if (!targetTenantId) {
      res.status(400).json({ error: `Missing ${paramKey}` });
      return;
    }

    if (targetTenantId !== req.user.tenantId) {
      res.status(403).json({ error: 'Access denied: different tenant' });
      return;
    }

    next();
  };
}
