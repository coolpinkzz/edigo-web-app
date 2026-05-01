import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { ConfirmationModal } from "../components/ConfirmationModal";
import {
  Button,
  Card,
  Input,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../components/ui";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDebouncedString } from "../hooks/useDebouncedValue";
import { useDeleteStudent } from "../hooks/useDeleteStudent";
import { useStudentFeeOverview } from "../hooks/useStudentFeeOverview";
import {
  FEE_STATUS_OPTIONS,
  STUDENT_CLASS_OPTIONS,
  type FeeStatus,
  type StudentClass,
  type StudentFeeOverviewSortBy,
} from "../types";
import { cn, formatInr, getErrorMessage } from "../utils";

const PAGE_SIZE = 20;

function feeStatusLabel(status: FeeStatus | null): string {
  if (status == null) return "—";
  return FEE_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
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

/** Soft rollup status pills (distinct from denser solid badges elsewhere). */
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
 * Student list with fee rollup columns; Edit and Delete actions.
 */
export function StudentsListPage() {
  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState<"" | StudentClass>("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedString(searchInput, 300);
  const [sortBy, setSortBy] = useState<StudentFeeOverviewSortBy>("studentName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, error } = useStudentFeeOverview({
    page,
    limit: PAGE_SIZE,
    class: isSchool ? classFilter || undefined : undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortDir,
  });

  const deleteMutation = useDeleteStudent();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const showCreated = searchParams.get("created") === "1";
  const showUpdated = searchParams.get("updated") === "1";
  const importedCount = searchParams.get("imported");

  useEffect(() => {
    if (!showCreated && !showUpdated && !importedCount) return;
    const id = window.setTimeout(() => {
      setSearchParams({}, { replace: true });
    }, 5000);
    return () => window.clearTimeout(id);
  }, [showCreated, showUpdated, importedCount, setSearchParams]);

  const toggleSort = (column: StudentFeeOverviewSortBy) => {
    setPage(1);
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("asc");
    }
  };

  const confirmDeleteStudent = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const totalPages = data?.totalPages ?? 0;
  const canPrev = page > 1;
  const canNext = totalPages > 0 && page < totalPages;

  const classOptions = [
    { value: SELECT_EMPTY_VALUE, label: "All classes" },
    ...STUDENT_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const hasListFilters = Boolean((isSchool && classFilter) || debouncedSearch);

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
      <ConfirmationModal
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete student?"
        description={
          deleteTarget ? (
            <>
              Delete student “<strong>{deleteTarget.name}</strong>”? This cannot
              be undone.
            </>
          ) : null
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="danger"
        isConfirming={deleteMutation.isPending}
        onConfirm={confirmDeleteStudent}
      />
      {showCreated && (
        <div
          className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground shadow-md shadow-primary/10 transition-opacity duration-300"
          role="status"
        >
          Student created successfully.
        </div>
      )}
      {showUpdated && (
        <div
          className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground shadow-md shadow-primary/10 transition-opacity duration-300"
          role="status"
        >
          Student updated successfully.
        </div>
      )}
      {importedCount != null && importedCount !== "" && (
        <div
          className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground shadow-md shadow-primary/10 transition-opacity duration-300"
          role="status"
        >
          Imported {importedCount} student{importedCount === "1" ? "" : "s"}{" "}
          successfully.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">
            Manage students for your organization.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSchool && (
            <Link to="/students/import">
              <Button type="button" variant="secondary">
                Import from Excel
              </Button>
            </Link>
          )}
          <Link to="/students/new">
            <Button type="button">Add student</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[16rem]">
          <Input
            label="Search"
            name="filter-search"
            placeholder="Name, admission ID, scholar ID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
            aria-label="Search students"
          />
        </div>
        {isSchool && (
          <div className="min-w-48">
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
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-card-border p-0! shadow-md shadow-black/6">
        {isLoading && (
          <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
        )}

        {isError && (
          <p className="px-6 py-8 text-sm text-red-600" role="alert">
            {error instanceof Error ? error.message : "Failed to load students"}
          </p>
        )}

        {deleteMutation.isError && deleteMutation.error && (
          <p
            className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700"
            role="alert"
          >
            {getErrorMessage(deleteMutation.error)}
          </p>
        )}

        {!isLoading && !isError && data && data.data.length === 0 && (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            {hasListFilters ? (
              "No students match your filters."
            ) : (
              <>
                No students yet.{" "}
                <Link
                  to="/students/new"
                  className="font-medium text-primary hover:underline"
                >
                  Add one
                </Link>
                .
              </>
            )}
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
                  const { student, feeSummary } = row;
                  const idLine = studentIdSubtitle(student);

                  const courseDisplay = isSchool
                    ? `${student.class ?? "—"} · ${student.section ?? "—"}`
                    : (student.course?.name ?? student.courseId) || "—";

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-card-border bg-card hover:bg-muted/40"
                    >
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
                      <td className="whitespace-nowrap px-6 py-4 align-middle">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/students/${student.id}/edit`}
                            className={cn(
                              "inline-flex h-9 w-9 items-center justify-center rounded-md border border-card-border bg-white text-muted-foreground shadow-xs motion-reduce:transition-none",
                              "transition-colors hover:bg-muted hover:text-primary",
                            )}
                            aria-label={`Edit ${student.studentName}`}
                          >
                            <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                          </Link>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-9 w-9 items-center justify-center rounded-md border border-card-border bg-white text-muted-foreground shadow-xs motion-reduce:transition-none",
                              "transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50",
                            )}
                            disabled={deleteMutation.isPending}
                            onClick={() =>
                              setDeleteTarget({
                                id: student.id,
                                name: student.studentName,
                              })
                            }
                            aria-label={`Delete ${student.studentName}`}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
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
