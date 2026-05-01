import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
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
  type StudentFeeOverviewSortBy,
  type StudentSection,
} from "../types";
import { cn, formatInr, getErrorMessage } from "../utils";

const PAGE_SIZE = 20;

function feeStatusLabel(status: FeeStatus | null): string {
  if (status == null) return "—";
  return FEE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
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

function initialFromName(name: string): string {
  const t = name.trim();
  const ch = t.charAt(0);
  return ch ? ch.toUpperCase() : "?";
}

function StudentAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string;
}) {
  const trimmed = photoUrl?.trim();
  const [broken, setBroken] = useState(false);

  if (trimmed && !broken) {
    return (
      <span className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-primary/15 ring-1 ring-border/60">
        <img
          src={trimmed}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary"
      aria-hidden
    >
      {initialFromName(name)}
    </span>
  );
}

function RollupBadge({
  status,
  label,
}: {
  status: FeeStatus | null;
  label: string;
}) {
  const tones = (() => {
    if (status == null)
      return "border border-border bg-muted/60 text-muted-foreground";
    switch (status) {
      case "PARTIAL":
        return "bg-[#FFF3BF] text-[#ca6f0a]";
      case "OVERDUE":
        return "bg-[#FFE3E3] text-[#C92A2A]";
      case "PENDING":
        return "border border-primary/35 bg-accent/80 text-accent-foreground";
      case "PAID":
        return "border border-primary/50 bg-primary/15 text-[#134e4a]";
      default:
        return "border border-border bg-muted/60 text-muted-foreground";
    }
  })();
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
        tones,
      )}
    >
      {label}
    </span>
  );
}

function studentIdSubtitle(s: {
  scholarId?: string;
  admissionId?: string;
}): string | null {
  const sch = s.scholarId?.trim();
  if (sch) return `Student ID · ${sch}`;
  const adm = s.admissionId?.trim();
  if (adm) return `Student ID · ${adm}`;
  return null;
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
  const [feeStatusFilter, setFeeStatusFilter] = useState<"" | FeeStatus>("");
  const [feeTypeFilter, setFeeTypeFilter] = useState<"" | FeeType>("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sortBy, setSortBy] = useState<StudentFeeOverviewSortBy>("studentName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, error } = useStudentFeeOverview({
    page,
    limit: PAGE_SIZE,
    class: isSchool ? classFilter || undefined : undefined,
    section: isSchool ? sectionFilter || undefined : undefined,
    search: debouncedSearch || undefined,
    feeStatuses: feeStatusFilter ? [feeStatusFilter] : undefined,
    feeTypes: feeTypeFilter ? [feeTypeFilter] : undefined,
    sortBy,
    sortDir,
  });

  const toggleSort = (column: StudentFeeOverviewSortBy) => {
    setPage(1);
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

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

  const feeStatusSelectOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All statuses" },
    ...FEE_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const feeTypeSelectOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All types" },
    ...FEE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const clearFilters = () => {
    setClassFilter("");
    setSectionFilter("");
    setSearchInput("");
    setFeeStatusFilter("");
    setFeeTypeFilter("");
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch.trim() !== "" ||
    (isSchool && classFilter !== "") ||
    (isSchool && sectionFilter !== "") ||
    feeStatusFilter !== "" ||
    feeTypeFilter !== "";

  function SortableHeader({
    label,
    column,
    className,
  }: {
    label: string;
    column: StudentFeeOverviewSortBy;
    className?: string;
  }) {
    const active = sortBy === column;
    return (
      <th scope="col" className={className}>
        <button
          type="button"
          className={cn(
            "inline-flex w-full items-center justify-start gap-1.5 pb-3 pt-3 text-left text-sm font-semibold text-accent-foreground",
            !active && "opacity-95",
          )}
          onClick={() => toggleSort(column)}
        >
          <span>{label}</span>
          {active ? (
            sortDir === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )
          ) : (
            <ChevronsUpDown
              className="h-3.5 w-3.5 shrink-0 opacity-45"
              aria-hidden
            />
          )}
          <span className="sr-only">
            {active
              ? sortDir === "asc"
                ? "sorted ascending"
                : "sorted descending"
              : "sort"}
          </span>
        </button>
      </th>
    );
  }

  const headerMuted =
    "px-6 pb-3 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Fee overview
          </h1>
          <p className="text-sm text-muted-foreground">
            All students with fee status, totals, and per-fee detail. Open
            filters when you need to narrow the list.
          </p>
        </div>
      </div> */}

      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1 sm:min-w-56">
            <Input
              label="Search"
              name="fee-overview-search"
              placeholder="Name, scholar ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
              aria-label="Search students"
            />
          </div>
          <div className="w-full min-w-0 sm:min-w-44 sm:max-w-56">
            <SelectField
              label="Fee status"
              name="fee-overview-status"
              options={feeStatusSelectOptions}
              value={
                feeStatusFilter === ""
                  ? SELECT_EMPTY_VALUE
                  : feeStatusFilter
              }
              onValueChange={(v) => {
                setPage(1);
                setFeeStatusFilter(
                  v === SELECT_EMPTY_VALUE ? "" : (v as FeeStatus),
                );
              }}
            />
          </div>
          <div className="w-full min-w-0 sm:min-w-44 sm:max-w-56">
            <SelectField
              label="Fee type"
              name="fee-overview-type"
              options={feeTypeSelectOptions}
              value={
                feeTypeFilter === "" ? SELECT_EMPTY_VALUE : feeTypeFilter
              }
              onValueChange={(v) => {
                setPage(1);
                setFeeTypeFilter(
                  v === SELECT_EMPTY_VALUE ? "" : (v as FeeType),
                );
              }}
            />
          </div>
          {isSchool && (
            <>
              <div className="w-full min-w-0 sm:min-w-44 sm:max-w-48">
                <SelectField
                  label="Class"
                  name="fee-overview-class"
                  options={classOptions}
                  value={
                    classFilter === "" ? SELECT_EMPTY_VALUE : classFilter
                  }
                  onValueChange={(v) => {
                    setClassFilter(
                      v === SELECT_EMPTY_VALUE ? "" : (v as StudentClass),
                    );
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-full min-w-0 sm:min-w-44 sm:max-w-48">
                <SelectField
                  label="Section"
                  name="fee-overview-section"
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
          {hasActiveFilters ? (
            <div className="flex shrink-0 pb-0.5 sm:ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={clearFilters}
              >
                Reset filters
              </Button>
            </div>
          ) : null}
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

      <Card className="overflow-hidden border-card-border p-0! shadow-md shadow-black/6">
        {isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        )}

        {!isLoading && !isError && data && data.data.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            No students match your filters.
          </p>
        )}

        {!isLoading && !isError && data && data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl text-left">
              <thead>
                <tr className="border-b border-card-border bg-primary/10">
                  <SortableHeader
                    column="studentName"
                    label="Student"
                    className="px-6"
                  />
                  {isSchool ? (
                    <SortableHeader column="class" label="Class" />
                  ) : (
                    <th scope="col" className="px-6 pb-3 pt-3 align-bottom">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-foreground">
                        Course
                      </span>
                    </th>
                  )}
                  <th scope="col" className={headerMuted}>
                    <span className="normal-case font-bold tracking-normal">
                      Rollup
                    </span>
                  </th>
                  <SortableHeader
                    column="pendingTotal"
                    label="Pending"
                    className="px-6"
                  />
                  <th scope="col" className={cn(headerMuted, "tabular-nums")}>
                    <span className="normal-case tracking-normal">Fees</span>
                  </th>
                  <th
                    scope="col"
                    className="whitespace-nowrap px-6 pb-3 pt-3 text-right align-bottom text-accent-foreground"
                  >
                    <span className="text-sm font-semibold">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => {
                  const { student, fees, feeSummary } = row;
                  const idLine = studentIdSubtitle(student);
                  const open = expanded.has(student.id);
                  const courseDisplay = isSchool
                    ? `${student.class ?? "—"} · ${student.section ?? "—"}`
                    : (student.course?.name ?? student.courseId) || "—";

                  return (
                    <Fragment key={student.id}>
                      <tr className="border-b border-card-border bg-card hover:bg-muted/40">
                        <td className="px-6 py-4 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <StudentAvatar
                              name={student.studentName}
                              photoUrl={student.photoUrl}
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/students/${student.id}`}
                                className="truncate font-semibold text-foreground hover:text-primary hover:underline"
                              >
                                {student.studentName}
                              </Link>
                              {idLine ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {idLine}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-sm text-muted-foreground">
                          {courseDisplay}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          <RollupBadge
                            status={feeSummary.rollupStatus}
                            label={feeStatusLabel(feeSummary.rollupStatus)}
                          />
                        </td>
                        <td className="px-6 py-4 align-middle text-sm font-semibold tabular-nums text-foreground">
                          {formatInr(feeSummary.pendingTotal)}
                        </td>
                        <td className="px-6 py-4 align-middle text-sm font-semibold tabular-nums text-foreground">
                          {feeSummary.feeCount}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right align-middle">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-card-border bg-white text-muted-foreground shadow-xs motion-reduce:transition-none",
                              "transition-all duration-200 ease-out hover:bg-muted hover:text-foreground active:scale-95 motion-reduce:active:scale-100",
                            )}
                            onClick={() => toggleExpanded(student.id)}
                            aria-expanded={open}
                            aria-label={
                              open
                                ? `Collapse fees for ${student.studentName}`
                                : `Expand fees for ${student.studentName}`
                            }
                          >
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 motion-reduce:transition-none",
                                "transition-transform duration-300 ease-out motion-reduce:duration-150",
                                open && "rotate-180",
                              )}
                            />
                          </button>
                        </td>
                      </tr>
                      <tr className={cn(open && "border-b border-card-border")}>
                        <td colSpan={6} className="p-0 align-top">
                          <div
                            className={cn(
                              "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                              open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                            )}
                          >
                            <div className="min-h-0 overflow-hidden">
                              <div
                                className={cn(
                                  "px-6 pb-4 pt-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
                                  open ? "opacity-100 delay-75" : "opacity-0",
                                )}
                                aria-hidden={!open}
                                inert={!open ? true : undefined}
                              >
                                <div className="overflow-hidden rounded-lg pt-4">
                                  {fees.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                      No fee records.
                                    </p>
                                  ) : (
                                    <div className="overflow-x-auto rounded-md border border-border/80 bg-background">
                                      <table className="min-w-3xl w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-card-border bg-muted/15">
                                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                              Title
                                            </th>
                                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                              Type
                                            </th>
                                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                              Status
                                            </th>
                                            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground tabular-nums">
                                              Total
                                            </th>
                                            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground tabular-nums">
                                              Paid
                                            </th>
                                            <th className="px-3 py-2.5 text-right text-xs font-medium text-muted-foreground tabular-nums">
                                              Pending
                                            </th>
                                            <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">
                                              Due by
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-card-border">
                                          {fees.map((f: FeeDto) => (
                                            <tr
                                              key={f.id}
                                              className="bg-background"
                                            >
                                              <td className="px-3 py-3 align-middle font-medium text-primary">
                                                <Link
                                                  to={`/students/${student.id}`}
                                                  className="hover:underline"
                                                >
                                                  {f.title}
                                                </Link>
                                              </td>
                                              <td className="px-3 py-3 align-middle font-medium uppercase text-muted-foreground">
                                                {f.feeType.replace(/_/g, " ")}
                                              </td>
                                              <td className="px-3 py-3 align-middle">
                                                <RollupBadge
                                                  status={f.status}
                                                  label={feeStatusLabel(
                                                    f.status,
                                                  )}
                                                />
                                              </td>
                                              <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                                                {formatInr(f.totalAmount)}
                                              </td>
                                              <td className="px-3 py-3 text-right font-medium tabular-nums text-primary">
                                                {formatInr(f.paidAmount)}
                                              </td>
                                              <td className="px-3 py-3 text-right tabular-nums text-foreground">
                                                {formatInr(f.pendingAmount)}
                                              </td>
                                              <td className="px-3 py-3 align-middle text-muted-foreground">
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
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && data && data.totalPages > 1 && (
          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-card-border px-6 py-4 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Page {data.page} of {data.totalPages}
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
                onClick={() => setPage((p) => (canNext ? p + 1 : p))}
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
