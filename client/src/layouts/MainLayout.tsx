import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  GitBranch,
  LayoutDashboard,
  FileText,
  Layers,
  LogOut,
  Settings,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "../components/ui";
import logoUrl from "../assets/logo.png";
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

function mainLayoutPageTitle(pathname: string): string {
  if (pathname === "/students/new") return "Add student";
  if (pathname === "/students/import") return "Import students";
  if (/\/students\/[^/]+\/edit$/.test(pathname)) return "Edit student";
  if (/^\/students\/[^/]+$/.test(pathname) && pathname !== "/students/new") {
    return "Student profile";
  }
  if (pathname.startsWith("/students")) return "Students";
  if (pathname === "/fee-overview") return "Fee overview";
  if (pathname === "/overdue") return "Overdue fees";
  if (pathname.startsWith("/attendance")) return "Attendance";
  if (pathname === "/team-management") return "Team management";
  if (pathname === "/branches") return "Branches";
  if (/\/fee-templates\/[^/]+\/assign$/.test(pathname)) {
    return "Assign fee structure";
  }
  if (/\/fee-templates\/[^/]+\/edit$/.test(pathname)) {
    return "Edit fee structure";
  }
  if (pathname === "/fee-templates/new") return "Create fee structure";
  if (pathname.startsWith("/fee-templates")) return "Fee structures";
  if (pathname === "/quotations/new") return "New quotation";
  if (/\/quotations\/[^/]+\/edit$/.test(pathname)) return "Edit quotation";
  if (/^\/quotations\/[^/]+$/.test(pathname)) return "Quotation";
  if (pathname.startsWith("/quotations")) return "Quotations";
  if (pathname.startsWith("/courses")) return "Courses";
  if (pathname === "/settings") return "Settings";
  return "Dashboard";
}

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

  const tenantHeaderLogoUrl = sessionQuery.data?.tenant?.logoUrl;
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false);
  useEffect(() => {
    setHeaderLogoFailed(false);
  }, [tenantHeaderLogoUrl]);
  const showHeaderTenantLogo = Boolean(
    tenantHeaderLogoUrl && !headerLogoFailed,
  );

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

  const title = mainLayoutPageTitle(pathname);

  const headerTitle =
    pathname === "/settings"
      ? "Settings"
      : pathname === "/branches"
        ? "Branches"
        : (sessionQuery.data?.tenant?.name ?? title);

  const navLink = (to: string, label: string, Icon: LucideIcon) => {
    const active =
      to === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(to);
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
    <div className="flex h-screen max-h-screen min-h-0 w-full overflow-hidden bg-background text-foreground">
      <aside
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 z-30 flex w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-card"
      >
        <div className="shrink-0 px-4 py-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="font-brand bg-primary-gradient bg-clip-text text-xl font-semibold tracking-tight text-transparent">
              Edigo
            </span>
          </Link>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-y-auto overflow-x-hidden p-3">
          {showDashboardStudents &&
            navLink("/dashboard", "Dashboard", LayoutDashboard)}
          {showFeeNav && navLink("/quotations", "Quotations", FileText)}
          {showFeeNav && navLink("/fee-overview", "Fee overview", Wallet)}
          {showFeeNav && navLink("/overdue", "Overdue fees", AlertTriangle)}
          {isSchoolTenant &&
            navLink("/attendance", "Attendance", ClipboardCheck)}
          {showDashboardStudents && navLink("/students", "Students", Users)}
          {showCoursesNav && navLink("/courses", "Courses", BookOpen)}
          {showTeamManagement &&
            navLink("/team-management", "Team management", UserCog)}
          {showTeamManagement && navLink("/branches", "Branches", GitBranch)}
          {showTeamManagement && navLink("/settings", "Settings", Settings)}
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-56">
        <header className="shrink-0 border-b border-border bg-card px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {showHeaderTenantLogo && (
              <img
                src={tenantHeaderLogoUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-md border border-border bg-background object-contain"
                onError={() => setHeaderLogoFailed(true)}
              />
            )}
            <h1 className="min-w-0 text-lg font-semibold text-foreground">
              {headerTitle}
            </h1>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
