import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
import { useStudents } from "../hooks/useStudents";
import { STUDENT_CLASS_OPTIONS } from "../types";
import type { StudentClass } from "../types";
import { getErrorMessage } from "../utils";

const PAGE_SIZE = 20;

function formatCourseDurationMonths(months: number | undefined): string {
  if (months == null || !Number.isFinite(months)) return "—";
  const n = Math.round(months);
  return `${n} month${n === 1 ? "" : "s"}`;
}

/**
 * Paginated student list with optional search and class filters and CRUD entry points.
 */
export function StudentsListPage() {
  const sessionQuery = useAuthSession();
  const isSchool = sessionQuery.data?.tenant?.tenantType === "SCHOOL";

  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState<"" | StudentClass>("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedString(searchInput, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, error } = useStudents({
    page,
    limit: PAGE_SIZE,
    class: isSchool ? classFilter || undefined : undefined,
    search: debouncedSearch || undefined,
  });
  const deleteMutation = useDeleteStudent();
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const navigate = useNavigate();
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
          <div className="min-w-[12rem]">
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

      <Card className="p-0! overflow-hidden">
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
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-border bg-primary-gradient text-primary-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Student</th>
                  <th className="px-6 py-3 font-medium">
                    {isSchool ? "Class" : "Course"}
                  </th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">
                    Scholar ID
                  </th>
                  <th className="px-6 py-3 font-medium whitespace-nowrap">
                    Course duration
                  </th>
                  <th className="px-6 py-3 font-medium">Parent</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.data.map((s) => (
                  <tr
                    key={s.id}
                    className="cursor-pointer bg-card transition-colors hover:bg-muted/80"
                    onClick={() => navigate(`/students/${s.id}`)}
                    aria-label={`Open profile for ${s.studentName}`}
                  >
                    <td className="px-6 py-3 font-medium text-foreground">
                      {s.studentName}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {isSchool
                        ? `${s.class ?? "—"} · ${s.section ?? "—"}`
                        : (s.course?.name ?? s.courseId ?? "—")}
                    </td>
                    <td className="px-6 py-3 font-mono text-sm tabular-nums text-muted-foreground">
                      {s.scholarId?.trim() ? s.scholarId : "—"}
                    </td>
                    <td className="px-6 py-3 tabular-nums text-muted-foreground">
                      {formatCourseDurationMonths(s.courseDurationMonths)}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {s.parentName}
                    </td>
                    <td className="px-6 py-3 tabular-nums text-muted-foreground">
                      {s.parentPhoneNumber}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div
                        className="flex flex-wrap items-center justify-end gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          to={`/students/${s.id}/edit`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          disabled={deleteMutation.isPending}
                          onClick={() =>
                            setDeleteTarget({
                              id: s.id,
                              name: s.studentName,
                            })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !isError && data && data.totalPages > 1 && (
          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center">
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
