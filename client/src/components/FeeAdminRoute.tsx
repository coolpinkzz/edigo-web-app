import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getRoleFromStorage, hasFeeFeatureAccess } from "../utils/auth";

type FeeAdminRouteProps = {
  children: ReactNode;
};

/**
 * Fee-related pages: TENANT_ADMIN and SUPER_ADMIN only (matches product rule).
 */
export function FeeAdminRoute({ children }: FeeAdminRouteProps) {
  const role = getRoleFromStorage();
  if (!hasFeeFeatureAccess(role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
