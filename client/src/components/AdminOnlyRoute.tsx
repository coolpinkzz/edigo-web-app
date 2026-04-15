import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getRoleFromStorage, hasTenantAdminAccess } from "../utils/auth";

type AdminOnlyRouteProps = {
  children: ReactNode;
};

/**
 * Renders children only for TENANT_ADMIN and SUPER_ADMIN; otherwise redirects home.
 * Server APIs must still enforce RBAC.
 */
export function AdminOnlyRoute({ children }: AdminOnlyRouteProps) {
  const role = getRoleFromStorage();
  if (!hasTenantAdminAccess(role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
