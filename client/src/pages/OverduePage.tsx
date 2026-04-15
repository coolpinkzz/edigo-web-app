import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../hooks/useAuthSession";
import { useCourses } from "../hooks/useCourses";
import {
  Button,
  Card,
  Input,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../components/ui";
import { useDebouncedString } from "../hooks/useDebouncedValue";
import { useOverdueFees } from "../hooks/useOverdueFees";
import {
  overdueReminderMutationKey,
  useSendOverdueReminder,
} from "../hooks/useSendOverdueReminder";
import {
  FEE_TYPE_OPTIONS,
  STUDENT_CLASS_OPTIONS,
  type FeeType,
  type StudentClass,
} from "../types";
import { cn, getErrorMessage } from "../utils";

const PAGE_SIZE = 20;

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function rowToneClass(days: number): string {
  if (days <= 7) return "bg-amber-50 hover:bg-amber-100";
  if (days <= 30) return "bg-red-100 hover:bg-red-200";
  return "bg-red-50/90 hover:bg-red-50";
}

function daysBadgeClass(days: number): string {
  if (days <= 7) return "bg-amber-200 text-amber-950";
  if (days <= 30) return "bg-red-300 text-red-950";
  return "bg-red-200 text-red-950";
}

/**
 * Overdue fees list (installment lines and lump-sum): recovery-focused actions and filters.
 */
export function OverduePage() {
  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState<"" | StudentClass>("");
  const [courseFilter, setCourseFilter] = useState("");
  const [feeTypeFilter, setFeeTypeFilter] = useState<"" | FeeType>("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedString(searchInput, 300);

  const coursesQuery = useCourses(
    { limit: 100, includeInactive: false },
    { enabled: !isSchool && sessionQuery.isSuccess },
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, error } = useOverdueFees({
    page,
    limit: PAGE_SIZE,
    class: isSchool ? classFilter || undefined : undefined,
    courseId: !isSchool ? courseFilter || undefined : undefined,
    feeType: feeTypeFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const reminderMutation = useSendOverdueReminder();
  // const runReminders = useRunReminders();

  const totalPages = data?.totalPages ?? 0;
  const canPrev = page > 1;
  const canNext = totalPages > 0 && page < totalPages;

  const classOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All classes" },
    ...STUDENT_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const courseOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All courses" },
    ...(coursesQuery.data?.data ?? [])
      .filter((c) => c.isActive)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  const feeTypeOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All fee types" },
    ...FEE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          Could not load organization settings. Try refreshing the page.
        </p>
      </div>
    );
  }

  if (!isSchool && coursesQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10">
        <p className="text-sm text-red-600" role="alert">
          Could not load courses. Add courses under Courses in the sidebar, then
          try again.
        </p>
        <Link
          to="/courses"
          className="text-sm font-medium text-primary hover:underline"
        >
          Go to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Overdue fees
          </h1>
          <p className="text-sm text-muted-foreground">
            Past-due installment lines and lump-sum fees (due date passed, unpaid)
            — prioritize follow-up and collection.
          </p>
        </div>
      </div> */}

      <div
        className={cn(
          "grid gap-4",
          data
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 [&>*:last-child]:sm:col-span-2 [&>*:last-child]:lg:col-span-1"
            : "grid-cols-1",
        )}
      >
        {/* {data && (
          <>
            <div className="rounded-xl border border-white/20 bg-primary-gradient p-4 text-primary-foreground shadow-lg shadow-black/20">
              <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                Total overdue amount
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-primary-foreground">
                {formatMoney(data.summary.totalOverdueAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-primary-gradient p-4 text-primary-foreground shadow-lg shadow-black/20">
              <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/80">
                Students with overdue fees
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-primary-foreground">
                {data.summary.totalStudents}
              </p>
            </div>
          </>
        )} */}

        {/* <div className="rounded-xl border border-card-border bg-card p-6 shadow-md shadow-black/6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Fee reminders
            </h2>
            <div className="group relative inline-flex">
              <button
                type="button"
                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="How fee reminders work"
              >
                <Info className="size-4 shrink-0" aria-hidden />
              </button>
              <div
                role="tooltip"
                className="pointer-events-none invisible absolute top-1/2 right-full z-20 mr-2 w-72 max-w-[min(18rem,calc(100vw-2rem))] -translate-y-1/2 rounded-md border border-border bg-popover px-3 py-2 text-left text-xs leading-relaxed text-popover-foreground shadow-md opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                Send SMS reminders for installment lines and lump-sum fees that
                are overdue or due within the next three days (with pending
                balance). The same daily dedupe applies: at most one SMS per
                installment or per lump-sum fee per IST day.
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={runReminders.isPending}
              onClick={() => runReminders.mutate()}
            >
              {runReminders.isPending ? "Running…" : "Run reminders now"}
            </Button>
            {runReminders.isError ? (
              <p className="text-sm text-red-600">
                {getErrorMessage(runReminders.error)}
              </p>
            ) : null}
          </div>

          {runReminders.isSuccess && runReminders.data.summary ? (
            <div className="mt-6 border-t border-border/60 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last run
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {runReminders.data.summary.runId}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Scanned</dt>
                  <dd className="font-semibold text-foreground">
                    {runReminders.data.summary.scanned}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">SMS sent</dt>
                  <dd className="font-semibold text-primary">
                    {runReminders.data.summary.smsSent}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Skipped (paid)</dt>
                  <dd className="font-medium text-foreground/90">
                    {runReminders.data.summary.skippedPaid}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    Skipped (already today)
                  </dt>
                  <dd className="font-medium text-foreground/90">
                    {runReminders.data.summary.skippedDedupe}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">No phone</dt>
                  <dd className="font-medium text-foreground/90">
                    {runReminders.data.summary.skippedNoPhone}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Errors</dt>
                  <dd className="font-medium text-foreground/90">
                    {runReminders.data.summary.errors}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div> */}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[12rem]">
          {isSchool ? (
            <SelectField
              label="Class"
              name="filter-class"
              options={classOptions}
              value={classFilter === "" ? SELECT_EMPTY_VALUE : classFilter}
              onValueChange={(v) => {
                setPage(1);
                setClassFilter(
                  v === SELECT_EMPTY_VALUE ? "" : (v as StudentClass),
                );
              }}
            />
          ) : (
            <SelectField
              label="Course"
              name="filter-course"
              options={courseOptions}
              value={courseFilter === "" ? SELECT_EMPTY_VALUE : courseFilter}
              onValueChange={(v) => {
                setPage(1);
                setCourseFilter(v === SELECT_EMPTY_VALUE ? "" : v);
              }}
              disabled={coursesQuery.isLoading}
            />
          )}
        </div>
        <div className="min-w-[12rem]">
          <SelectField
            label="Fee type"
            name="filter-fee-type"
            options={feeTypeOptions}
            value={feeTypeFilter === "" ? SELECT_EMPTY_VALUE : feeTypeFilter}
            onValueChange={(v) => {
              setPage(1);
              setFeeTypeFilter(v === SELECT_EMPTY_VALUE ? "" : (v as FeeType));
            }}
          />
        </div>
        <div className="min-w-[16rem] flex-1">
          <Input
            label="Search student"
            name="search-student"
            type="search"
            placeholder="Name contains…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0!">
        {/* <div className="border-b border-border px-6 py-4">
          <CardTitle className="text-lg">Overdue fees</CardTitle>
          <CardDescription>
            {data != null && (
              <>
                Showing {data.data.length} of {data.total} row
                {data.total === 1 ? "" : "s"}
                {debouncedSearch ? ` matching “${debouncedSearch}”` : ""}.
              </>
            )}
          </CardDescription>
          <p className="mt-2 text-xs text-muted-foreground">
            Row color: amber (1–7 days), orange (8–30), red (31+). Per-row and
            bulk reminders use the same daily dedupe rules.
          </p>
        </div> */}

        {isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        )}

        {isError && (
          <p className="px-6 py-6 text-sm text-red-600">
            {getErrorMessage(error)}
          </p>
        )}

        {!isLoading && !isError && data && data.data.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No overdue fees match your filters.
          </p>
        )}

        {!isLoading && !isError && data && data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-border bg-primary-gradient text-xs uppercase tracking-wide text-primary-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium text-right">Pending</th>
                  <th className="px-4 py-3 font-medium">Due date</th>
                  <th className="px-4 py-3 font-medium">Days overdue</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.data.map((row) => (
                  <tr
                    key={`${row.feeId}-${row.installmentId || "lump"}`}
                    className={cn(
                      "transition-colors",
                      rowToneClass(row.daysOverdue),
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.studentName}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-foreground/80">
                      <span className="line-clamp-2" title={row.feeTitle}>
                        {row.feeTitle}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">
                      {formatMoney(row.pendingAmount)}
                    </td>
                    <td className="px-4 py-3 text-foreground/80">
                      {formatDate(row.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                          daysBadgeClass(row.daysOverdue),
                        )}
                      >
                        {row.daysOverdue}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/students/${row.studentId}`}
                          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-muted"
                        >
                          Pay now
                        </Link>
                        <Button
                          type="button"
                          className="px-3 py-1.5 text-sm"
                          disabled={
                            reminderMutation.isPending &&
                            reminderMutation.variables != null &&
                            overdueReminderMutationKey(
                              reminderMutation.variables,
                            ) === overdueReminderMutationKey(row)
                          }
                          onClick={() =>
                            reminderMutation.mutate({
                              installmentId: row.installmentId,
                              feeId: row.feeId,
                            })
                          }
                        >
                          {reminderMutation.isPending &&
                          reminderMutation.variables != null &&
                          overdueReminderMutationKey(
                            reminderMutation.variables,
                          ) === overdueReminderMutationKey(row)
                            ? "Sending…"
                            : "Send reminder"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {reminderMutation.isError && (
          <p className="border-t border-border/60 px-6 py-3 text-sm text-red-600">
            {getErrorMessage(reminderMutation.error)}
          </p>
        )}

        {reminderMutation.isSuccess && reminderMutation.data?.ok === true && (
          <p
            className="border-t border-border/60 px-6 py-3 text-sm text-primary"
            role="status"
          >
            {reminderMutation.data.message}
          </p>
        )}

        {!isLoading && !isError && data && data.total > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages || 1}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
