import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthSession } from "../hooks/useAuthSession";

type AcademyOnlyRouteProps = {
  children: ReactNode;
};

/**
 * Renders children only when tenant is ACADEMY (course catalog). SCHOOL tenants redirect home.
 */
export function AcademyOnlyRoute({ children }: AcademyOnlyRouteProps) {
  const sessionQuery = useAuthSession();
  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  const tenantType = sessionQuery.data?.tenant?.tenantType ?? "SCHOOL";
  if (tenantType === "SCHOOL") {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
