import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Layers,
  LogOut,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "../components/ui";
import { useAuthSession } from "../hooks/useAuthSession";
import {
  clearAccessToken,
  getNameFromStorage,
  getRoleDisplayLabel,
  getRoleFromStorage,
  hasFeeFeatureAccess,
  hasTenantAdminAccess,
  isStaffRole,
} from "../utils/auth";
import { cn } from "../utils/cn";

/**
 * App shell: persistent header + sidebar; page content renders in `<Outlet />`.
 */
export function MainLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionQuery = useAuthSession();
  const accountName = getNameFromStorage();
  const role = getRoleFromStorage();
  const roleLabel = getRoleDisplayLabel(role);
  const staffOnlyAttendance = isStaffRole(role);
  const showFeeNav = hasFeeFeatureAccess(role);
  const showTeamManagement = hasTenantAdminAccess(role);
  const showDashboardStudents = !staffOnlyAttendance;
  const isAcademyTenant = sessionQuery.data?.tenant?.tenantType === "ACADEMY";
  const isSchoolTenant = sessionQuery.data?.tenant?.tenantType === "SCHOOL";
  const showCoursesNav =
    showTeamManagement && showDashboardStudents && isAcademyTenant;

  function handleLogout(): void {
    clearAccessToken();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading session…</p>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-6">
        <p className="text-sm text-red-600" role="alert">
          Could not load your session. Try logging in again.
        </p>
        <Button
          type="button"
          onClick={() => {
            clearAccessToken();
            queryClient.clear();
            navigate("/login", { replace: true });
          }}
        >
          Go to login
        </Button>
      </div>
    );
  }

  const title =
    pathname === "/students/new"
      ? "Add student"
      : pathname === "/students/import"
        ? "Import students"
        : /\/students\/[^/]+\/edit$/.test(pathname)
          ? "Edit student"
          : /^\/students\/[^/]+$/.test(pathname) && pathname !== "/students/new"
            ? "Student profile"
            : pathname.startsWith("/students")
              ? "Students"
              : pathname === "/fee-overview"
                ? "Fee overview"
                : pathname === "/overdue"
                  ? "Overdue fees"
                  : pathname.startsWith("/attendance")
                    ? "Attendance"
                    : pathname === "/team-management"
                      ? "Team management"
                      : /\/fee-templates\/[^/]+\/assign$/.test(pathname)
                        ? "Assign fee structure"
                        : pathname === "/fee-templates/new"
                          ? "Create fee structure"
                          : pathname.startsWith("/fee-templates")
                            ? "Fee structures"
                            : pathname.startsWith("/courses")
                              ? "Courses"
                              : "Dashboard";

  const navLink = (to: string, label: string, Icon: LucideIcon) => {
    const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
    return (
      <Link
        to={to}
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-foreground/80 hover:bg-muted",
        )}
      >
        <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <div className="flex h-screen min-h-0 w-full bg-background text-foreground">
      <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
        <div className="shrink-0 border-b border-border px-4 py-4">
          <span className="text-sm font-semibold tracking-tight">EduRapid</span>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-hidden p-3">
          {showDashboardStudents && navLink("/", "Dashboard", LayoutDashboard)}
          {showFeeNav && navLink("/fee-overview", "Fee overview", Wallet)}
          {showFeeNav && navLink("/overdue", "Overdue fees", AlertTriangle)}
          {isSchoolTenant && navLink("/attendance", "Attendance", ClipboardCheck)}
          {showDashboardStudents && navLink("/students", "Students", Users)}
          {showCoursesNav && navLink("/courses", "Courses", BookOpen)}
          {showTeamManagement &&
            navLink("/team-management", "Team management", UserCog)}
          {showFeeNav && navLink("/fee-templates", "Fee structures", Layers)}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          {(accountName || roleLabel) && (
            <div className="mb-2 space-y-0.5">
              {accountName && (
                <p
                  className="truncate text-sm font-medium text-foreground"
                  title={accountName}
                >
                  {accountName}
                </p>
              )}
              {roleLabel && (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={roleLabel}
                >
                  {roleLabel}
                </p>
              )}
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-center gap-2"
            onClick={handleLogout}
          >
            <LogOut className="size-4 shrink-0 opacity-80" aria-hidden />
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-border bg-card px-6 py-4">
          <h1 className="text-lg font-semibold text-foreground">
            {sessionQuery.data?.tenant?.name ?? title}
          </h1>
        </header>
        <main className="min-h-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
