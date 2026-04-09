import { useMemo, useState } from "react";
import { AlertTriangle, Clock, IndianRupee, Users } from "lucide-react";
import { ClassPerformanceChart } from "../components/dashboard/ClassPerformanceChart";
import { DashboardDateRangePicker } from "../components/dashboard/DashboardDateRangePicker";
import { RevenueTrendChart } from "../components/dashboard/RevenueTrendChart";
import { SettlementReconciliation } from "../components/dashboard/SettlementReconciliation";
import { useDashboardClassPerformance } from "../hooks/useDashboardClassPerformance";
import { useDashboardRevenueTrend } from "../hooks/useDashboardRevenueTrend";
import { useDashboardSettlements } from "../hooks/useDashboardSettlements";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDashboardOverview } from "../hooks/useDashboardOverview";
import { useOverdueFees } from "../hooks/useOverdueFees";
import type { DashboardTrendGranularity } from "../types";
import { cn, formatInr, getErrorMessage } from "../utils";
import {
  defaultCustomDateStrings,
  parseDateInputRange,
} from "../utils/dashboard-dates";

/** Matches server max span for GET /dashboard/revenue-trend. */
const REVENUE_TREND_MAX_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function inferTrendGranularity(
  from: Date,
  to: Date,
): DashboardTrendGranularity {
  const days = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (days <= 90) return "daily";
  if (days <= 400) return "weekly";
  return "monthly";
}

type PeriodTab = "this-month" | "till-date" | "custom";

type DashboardRange = {
  from: Date;
  to: Date;
  compare: boolean;
  valid: boolean;
};

function buildDashboardRange(
  tab: PeriodTab,
  customFrom: string,
  customTo: string,
): DashboardRange {
  const now = new Date();
  if (tab === "till-date") {
    return { from: new Date(0), to: now, compare: false, valid: true };
  }
  if (tab === "this-month") {
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    return { from, to: now, compare: true, valid: true };
  }
  const parsed = parseDateInputRange(customFrom, customTo);
  return {
    from: parsed.from,
    to: parsed.to,
    compare: true,
    valid: parsed.valid,
  };
}

/**
 * Authenticated home — overview KPIs and charts.
 */
export function DashboardPage() {
  const sessionQuery = useAuthSession();
  const isAcademy = sessionQuery.data?.tenant?.tenantType === "ACADEMY";

  const [periodTab, setPeriodTab] = useState<PeriodTab>("this-month");
  const [customDates, setCustomDates] = useState(() =>
    defaultCustomDateStrings(),
  );

  const range = useMemo(
    () => buildDashboardRange(periodTab, customDates.from, customDates.to),
    [periodTab, customDates.from, customDates.to],
  );

  const trendWindow = useMemo(() => {
    if (!range.valid) {
      return { from: range.from, to: range.to, clamped: false };
    }
    const span = range.to.getTime() - range.from.getTime();
    if (span > REVENUE_TREND_MAX_MS) {
      return {
        from: new Date(range.to.getTime() - REVENUE_TREND_MAX_MS),
        to: range.to,
        clamped: true,
      };
    }
    return { from: range.from, to: range.to, clamped: false };
  }, [range]);

  const trendGranularity = useMemo(
    () => inferTrendGranularity(trendWindow.from, trendWindow.to),
    [trendWindow.from, trendWindow.to],
  );

  const overview = useDashboardOverview({
    from: range.from,
    to: range.to,
    compare: range.compare,
    enabled: range.valid,
  });
  /** Same summary as GET /fees/overdue (unfiltered), matching Overdue fees page. */
  const overdue = useOverdueFees({
    page: 1,
    limit: 1,
    enabled: range.valid,
  });
  const revenueTrend = useDashboardRevenueTrend({
    from: trendWindow.from,
    to: trendWindow.to,
    granularity: trendGranularity,
    enabled: range.valid,
  });
  const classPerformance = useDashboardClassPerformance(range.valid);
  const settlements = useDashboardSettlements({ page: 1, limit: 15 });

  const d = range.valid ? overview.data : undefined;
  const loadingMetrics = range.valid && overview.isLoading;
  const metricsError = range.valid && overview.isError;
  const overdueSummary = overdue.data?.summary;
  const loadingOverdue = range.valid && overdue.isLoading;
  const overdueError = range.valid && overdue.isError;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-card-border bg-card p-6 shadow-md shadow-black/[0.06]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Overview</h2>
          </div>
          <div
            className="inline-flex rounded-lg border border-border bg-muted p-0.5"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={periodTab === "this-month"}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                periodTab === "this-month"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPeriodTab("this-month")}
            >
              This month
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={periodTab === "till-date"}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                periodTab === "till-date"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPeriodTab("till-date")}
            >
              Till date
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={periodTab === "custom"}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                periodTab === "custom"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setPeriodTab("custom")}
            >
              Custom
            </button>
          </div>
        </div>

        {periodTab === "custom" ? (
          <div className="mt-4 max-w-sm">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Date range
            </p>
            <DashboardDateRangePicker
              fromStr={customDates.from}
              toStr={customDates.to}
              onRangeChange={setCustomDates}
            />
            {!range.valid ? (
              <p className="mt-2 text-sm text-red-600" role="alert">
                From must be on or before To.
              </p>
            ) : null}
          </div>
        ) : null}

        {metricsError ? (
          <p className="mt-4 text-sm text-red-600">
            {getErrorMessage(overview.error)}
          </p>
        ) : null}
        {overdueError ? (
          <p className="mt-4 text-sm text-red-600">
            {getErrorMessage(overdue.error)}
          </p>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-primary-foreground shadow-lg shadow-black/20">
            <dt className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-foreground/80">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20"
                aria-hidden
              >
                <IndianRupee className="h-4 w-4 opacity-90" />
              </span>
              Collected
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-primary-foreground">
              {loadingMetrics ? "—" : formatInr(d?.collected.amount ?? 0)}
            </dd>
            {d &&
            (d.collected.onlineAmount > 0 || d.collected.manualAmount > 0) ? (
              <p className="mt-2 text-xs text-primary-foreground/85">
                Online {formatInr(d.collected.onlineAmount)} · Manual{" "}
                {formatInr(d.collected.manualAmount)}
              </p>
            ) : null}
            {d &&
            range.compare &&
            d.collected.changePercent != null &&
            d.comparePeriod ? (
              <p className="mt-2 text-xs text-primary-foreground/85">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 font-medium",
                    d.collected.changePercent >= 0
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-rose-400 text-primary-foreground",
                  )}
                >
                  {d.collected.changePercent >= 0 ? "+" : ""}
                  {d.collected.changePercent.toFixed(2)}%
                </span>{" "}
                vs prior period
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-primary-foreground shadow-lg shadow-black/20">
            <dt className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-foreground/80">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20"
                aria-hidden
              >
                <Clock className="h-4 w-4 opacity-90" />
              </span>
              Pending (total due)
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-primary-foreground">
              {loadingMetrics ? "—" : formatInr(d?.pending.amount ?? 0)}
            </dd>
            <p className="mt-2 text-xs text-primary-foreground/85">
              All open fees
            </p>
          </div>

          <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-primary-foreground shadow-lg shadow-black/20">
            <dt className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-foreground/80">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20"
                aria-hidden
              >
                <AlertTriangle className="h-4 w-4 opacity-90" />
              </span>
              Total overdue amount
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-primary-foreground">
              {loadingOverdue ? "—" : formatInr(overdueSummary?.totalOverdueAmount ?? 0)}
            </dd>
            <p className="mt-2 text-xs text-primary-foreground/85">
              Past-due installment balances
            </p>
          </div>

          <div className="rounded-lg border border-white/20 bg-primary-gradient p-4 text-primary-foreground shadow-lg shadow-black/20">
            <dt className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary-foreground/80">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/20"
                aria-hidden
              >
                <Users className="h-4 w-4 opacity-90" />
              </span>
              Students with overdue installments
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-primary-foreground">
              {loadingOverdue
                ? "—"
                : (overdueSummary?.totalStudents ?? "—")}
            </dd>
            <p className="mt-2 text-xs text-primary-foreground/85">
              Distinct students with at least one overdue
            </p>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-card-border bg-card p-6 shadow-md shadow-black/[0.06]">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Revenue trend
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Collected (online + manual) vs installment amounts scheduled in
              each period. Same date range as Overview
              {trendWindow.clamped ? " (last 2 years for this chart)" : ""}.
            </p>
          </div>
          <div className="mt-4">
            <RevenueTrendChart
              data={revenueTrend.data}
              loading={range.valid && revenueTrend.isLoading}
              errorMessage={
                range.valid && revenueTrend.isError
                  ? getErrorMessage(revenueTrend.error)
                  : null
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-card-border bg-card p-6 shadow-md shadow-black/[0.06]">
          <h2 className="text-lg font-semibold text-foreground">
            {isAcademy ? "Course performance" : "Class performance"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAcademy
              ? "Share of assigned fee totals collected per course (paid ÷ total)."
              : "Share of assigned fee totals collected per class (paid ÷ total)."}
          </p>
          <div className="mt-4">
            <ClassPerformanceChart
              rows={classPerformance.data?.rows}
              loading={range.valid && classPerformance.isLoading}
              errorMessage={
                range.valid && classPerformance.isError
                  ? getErrorMessage(classPerformance.error)
                  : null
              }
              segmentLabel={isAcademy ? "course" : "class"}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card p-6 shadow-md shadow-black/[0.06]">
        <h2 className="text-lg font-semibold text-foreground">
          Settlement reconciliation
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare gateway collections with Razorpay settlement batches. Amounts
          are synced from Razorpay every 6 hours; payments are linked when
          Razorpay exposes a settlement id.
        </p>
        <div className="mt-4">
          <SettlementReconciliation
            data={settlements.data}
            loading={settlements.isLoading}
            errorMessage={
              settlements.isError ? getErrorMessage(settlements.error) : null
            }
          />
        </div>
      </div>
    </div>
  );
}
