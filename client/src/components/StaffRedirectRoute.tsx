import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getRoleFromStorage, isStaffRole } from "../utils/auth";

type StaffRedirectRouteProps = {
  children: ReactNode;
};

/**
 * STAFF may only use attendance in the app shell — redirect to `/attendance` from other pages.
 */
export function StaffRedirectRoute({ children }: StaffRedirectRouteProps) {
  const role = getRoleFromStorage();
  if (isStaffRole(role)) {
    return <Navigate to="/attendance" replace />;
  }
  return <>{children}</>;
}
