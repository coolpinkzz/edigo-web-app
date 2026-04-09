import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Filter, FilterX } from "lucide-react";
import {
  Button,
  Card,
  Input,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../components/ui";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDebouncedString } from "../hooks/useDebouncedValue";
import { useStudentFeeOverview } from "../hooks/useStudentFeeOverview";
import {
  FEE_STATUS_OPTIONS,
  FEE_TYPE_OPTIONS,
  STUDENT_CLASS_OPTIONS,
  STUDENT_SECTION_OPTIONS,
  type FeeDto,
  type FeeStatus,
  type FeeType,
  type StudentClass,
  type StudentSection,
} from "../types";
import { cn, formatInr, getErrorMessage } from "../utils";

const PAGE_SIZE = 20;

/** Solid bright pills — white text on saturated fills. */
function statusBadgeClass(status: FeeStatus | null): string {
  if (status == null) return "bg-muted text-muted-foreground";
  switch (status) {
    case "OVERDUE":
      return "bg-red-500 text-white dark:bg-red-600";
    case "PARTIAL":
      return "bg-amber-300 text-amber-800 dark:bg-amber-200";
    case "PENDING":
      return "bg-red-500 text-white dark:bg-red-400";
    case "PAID":
      return "bg-emerald-500 text-white dark:bg-emerald-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function feeStatusLabel(status: FeeStatus | null): string {
  if (status == null) return "—";
  return FEE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function feeRowStatusClass(status: FeeStatus): string {
  return statusBadgeClass(status);
}

function feeDueByLabel(f: FeeDto): string {
  if (f.isInstallment) return "—";
  if (!f.endDate) return "—";
  return new Date(f.endDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Command center: students with fee aggregates, filters, and expandable fee lines.
 */
export function FeeOverviewPage() {
  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState<"" | StudentClass>("");
  const [sectionFilter, setSectionFilter] = useState<"" | StudentSection>("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedString(searchInput, 300);
  const [feeStatusFilters, setFeeStatusFilters] = useState<FeeStatus[]>([]);
  const [feeTypeFilters, setFeeTypeFilters] = useState<FeeType[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, error } = useStudentFeeOverview({
    page,
    limit: PAGE_SIZE,
    class: isSchool ? classFilter || undefined : undefined,
    section: isSchool ? sectionFilter || undefined : undefined,
    search: debouncedSearch || undefined,
    feeStatuses: feeStatusFilters.length ? feeStatusFilters : undefined,
    feeTypes: feeTypeFilters.length ? feeTypeFilters : undefined,
  });

  const toggleExpanded = (studentId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const totalPages = data?.totalPages ?? 0;
  const canPrev = page > 1;
  const canNext = totalPages > 0 && page < totalPages;

  const classOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All classes" },
    ...STUDENT_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const sectionOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All sections" },
    ...STUDENT_SECTION_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const toggleFeeStatus = (value: FeeStatus) => {
    setFeeStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
    setPage(1);
  };

  const toggleFeeType = (value: FeeType) => {
    setFeeTypeFilters((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
    setPage(1);
  };

  const clearFilters = () => {
    setClassFilter("");
    setSectionFilter("");
    setSearchInput("");
    setFeeStatusFilters([]);
    setFeeTypeFilters([]);
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== "" ||
    (isSchool && classFilter !== "") ||
    (isSchool && sectionFilter !== "") ||
    feeStatusFilters.length > 0 ||
    feeTypeFilters.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Fee overview
          </h1>
          <p className="text-sm text-muted-foreground">
            All students with fee status, totals, and per-fee detail. Open
            filters when you need to narrow the list.
          </p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              filtersOpen
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-background text-foreground hover:bg-muted",
            )}
            aria-expanded={filtersOpen}
            aria-controls="fee-overview-filters"
            id="fee-overview-filters-toggle"
          >
            <Filter
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            {filtersOpen ? "Hide filters" : "Show filters"}
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none",
                filtersOpen && "rotate-180",
              )}
              aria-hidden
            />
          </button>
          {hasActiveFilters && !filtersOpen ? (
            <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
              Filters active
            </span>
          ) : null}
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={clearFilters}
            >
              <FilterX className="h-4 w-4 shrink-0" aria-hidden />
              Reset filters
            </Button>
          ) : null}
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
            filtersOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              id="fee-overview-filters"
              role="region"
              aria-labelledby="fee-overview-filters-toggle"
              aria-hidden={!filtersOpen}
              inert={!filtersOpen}
              className={cn(
                "mt-4 space-y-4 border-t border-border pt-4 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                filtersOpen ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Search
                  </label>
                  <Input
                    placeholder="Name, scholar ID…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    aria-label="Search students"
                  />
                </div>
                {isSchool && (
                  <>
                    <div>
                      <SelectField
                        label="Class"
                        options={classOptions}
                        value={
                          classFilter === ""
                            ? SELECT_EMPTY_VALUE
                            : classFilter
                        }
                        onValueChange={(v) => {
                          setClassFilter(
                            v === SELECT_EMPTY_VALUE
                              ? ""
                              : (v as StudentClass),
                          );
                          setPage(1);
                        }}
                      />
                    </div>
                    <div>
                      <SelectField
                        label="Section"
                        options={sectionOptions}
                        value={
                          sectionFilter === ""
                            ? SELECT_EMPTY_VALUE
                            : sectionFilter
                        }
                        onValueChange={(v) => {
                          setSectionFilter(
                            v === SELECT_EMPTY_VALUE
                              ? ""
                              : (v as StudentSection),
                          );
                          setPage(1);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Fee status (match any selected — same fee row)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FEE_STATUS_OPTIONS.map((opt) => {
                      const on = feeStatusFilters.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleFeeStatus(opt.value)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            on
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Fee type
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FEE_TYPE_OPTIONS.map((opt) => {
                      const on = feeTypeFilters.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleFeeType(opt.value)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            on
                              ? "border-primary bg-primary/15 text-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isError && (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {getErrorMessage(error)}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-card-border bg-card shadow-md shadow-black/[0.06]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-primary-gradient text-primary-foreground">
            <tr className="border-b border-border">
              <th
                className="w-10 px-3 py-3 font-medium text-primary-foreground"
                scope="col"
              />
              <th
                className="px-3 py-3 font-medium text-primary-foreground"
                scope="col"
              >
                Student
              </th>
              <th
                className="px-3 py-3 font-medium text-primary-foreground"
                scope="col"
              >
                {isSchool ? "Class" : "Course"}
              </th>
              <th
                className="px-3 py-3 font-medium text-primary-foreground"
                scope="col"
              >
                Rollup
              </th>
              <th
                className="px-3 py-3 font-medium text-primary-foreground"
                scope="col"
              >
                Pending
              </th>
              <th
                className="px-3 py-3 font-medium text-primary-foreground"
                scope="col"
              >
                Fees
              </th>
            </tr>
          </thead>
          <tbody className="text-base font-semibold text-foreground">
            {isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center font-normal text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data && data.data.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center font-normal text-muted-foreground"
                >
                  No students match your filters.
                </td>
              </tr>
            )}
            {!isLoading &&
              data?.data.map((row) => {
                const { student, fees, feeSummary } = row;
                const isOpen = expanded.has(student.id);
                return (
                  <Fragment key={student.id}>
                    <tr
                      className="cursor-pointer border-b border-border/80 hover:bg-muted/30"
                      onClick={() => toggleExpanded(student.id)}
                    >
                      <td className="px-1 py-2 align-middle">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleExpanded(student.id);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-expanded={isOpen}
                          aria-label={
                            isOpen
                              ? `Collapse fees for ${student.studentName}`
                              : `Expand fees for ${student.studentName}`
                          }
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Link
                          to={`/students/${student.id}`}
                          className="text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {student.studentName}
                        </Link>
                        {student.scholarId ? (
                          <p className="text-xs text-muted-foreground">
                            {student.scholarId}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">
                        {isSchool
                          ? `${student.class ?? "—"} · ${student.section ?? "—"}`
                          : student.course?.name ??
                            student.courseId ??
                            "—"}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            statusBadgeClass(feeSummary.rollupStatus),
                          )}
                        >
                          {feeStatusLabel(feeSummary.rollupStatus)}
                        </span>
                      </td>
                      <td className="px-3 py-2 align-middle tabular-nums">
                        {formatInr(feeSummary.pendingTotal)}
                      </td>
                      <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">
                        {feeSummary.feeCount}
                      </td>
                    </tr>
                    <tr className="border-b border-border/80 bg-muted/20">
                      <td colSpan={6} className="p-0">
                        <div
                          className={cn(
                            "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div
                              className={cn(
                                "px-3 py-3 transition-opacity duration-300 ease-out motion-reduce:transition-none",
                                isOpen ? "opacity-100" : "opacity-0",
                              )}
                              aria-hidden={!isOpen}
                              inert={!isOpen}
                            >
                              {fees.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                  No fee records.
                                </p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-card-border bg-background shadow-md shadow-black/[0.05]">
                                  <table className="w-full min-w-[520px] text-sm">
                                    <thead className="bg-primary-gradient text-primary-foreground">
                                      <tr className="border-b border-border text-left">
                                        <th className="px-2 py-2 font-semibold">
                                          Title
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                          Type
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                          Status
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                          Total
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                          Paid
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                          Pending
                                        </th>
                                        <th className="px-2 py-2 font-semibold">
                                          Due by
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="font-semibold text-foreground">
                                      {fees.map((f) => (
                                        <tr
                                          key={f.id}
                                          className="border-b border-border/60 last:border-0"
                                        >
                                          <td className="px-2 py-2">
                                            <Link
                                              to={`/students/${student.id}`}
                                              className="text-primary hover:underline"
                                            >
                                              {f.title}
                                            </Link>
                                          </td>
                                          <td className="px-2 py-2 text-muted-foreground">
                                            {f.feeType}
                                          </td>
                                          <td className="px-2 py-2">
                                            <span
                                              className={cn(
                                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                                feeRowStatusClass(f.status),
                                              )}
                                            >
                                              {feeStatusLabel(f.status)}
                                            </span>
                                          </td>
                                          <td className="px-2 py-2 tabular-nums">
                                            {formatInr(f.totalAmount)}
                                          </td>
                                          <td className="px-2 py-2 tabular-nums text-muted-foreground">
                                            {formatInr(f.paidAmount)}
                                          </td>
                                          <td className="px-2 py-2 tabular-nums">
                                            {formatInr(f.pendingAmount)}
                                          </td>
                                          <td className="px-2 py-2 text-muted-foreground font-normal">
                                            {feeDueByLabel(f)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!canPrev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              Page {page} / {totalPages || 1}
            </span>
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
    </div>
  );
}
