import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAttendance, listStudents, markAttendance } from "../api";
import {
  Button,
  Card,
  ConfirmationModal,
  Input,
  SELECT_EMPTY_VALUE,
  SelectField,
} from "../components/ui";
import { attendanceQueryKey, studentsQueryKey } from "../constants/query-keys";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDebouncedString } from "../hooks/useDebouncedValue";
import type { AttendanceRecordStatus } from "../types";
import {
  STUDENT_CLASS_OPTIONS,
  STUDENT_SECTION_OPTIONS,
  type StudentClass,
  type StudentSection,
} from "../types";
import { getRoleFromStorage, hasStaffAccess } from "../utils/auth";
import { cn } from "../utils/cn";
import { getErrorMessage } from "../utils";

const ROSTER_LIMIT = 100;

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Class-wise attendance: fast toggles, search, bulk all present, submit.
 */
export function AttendancePage() {
  const sessionQuery = useAuthSession();
  const queryClient = useQueryClient();
  const [classFilter, setClassFilter] = useState<StudentClass | "">("");
  const [sectionFilter, setSectionFilter] = useState<StudentSection | "">("");
  const [dateKey, setDateKey] = useState(todayDateKey);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedString(searchInput, 200);
  const [statusById, setStatusById] = useState<
    Record<string, AttendanceRecordStatus>
  >({});
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const canMark = hasStaffAccess(getRoleFromStorage());

  const filtersReady = Boolean(classFilter && sectionFilter);

  const rosterQuery = useQuery({
    queryKey: [
      ...studentsQueryKey,
      "roster",
      classFilter,
      sectionFilter,
    ] as const,
    queryFn: () =>
      listStudents({
        page: 1,
        limit: ROSTER_LIMIT,
        class: classFilter || undefined,
        section: sectionFilter || undefined,
        status: "ACTIVE",
      }),
    enabled: filtersReady,
  });

  const attendanceQuery = useQuery({
    queryKey: [
      ...attendanceQueryKey,
      dateKey,
      classFilter,
      sectionFilter,
    ] as const,
    queryFn: () =>
      getAttendance({
        dateKey,
        class: classFilter as StudentClass,
        section: sectionFilter as StudentSection,
      }),
    enabled: filtersReady && Boolean(dateKey),
  });

  const students = useMemo(
    () => rosterQuery.data?.data ?? [],
    [rosterQuery.data],
  );

  const rosterTruncated =
    rosterQuery.data != null &&
    rosterQuery.data.total > rosterQuery.data.data.length;

  useEffect(() => {
    if (!students.length) {
      setStatusById({});
      return;
    }
    const fromServer = attendanceQuery.data;
    const next: Record<string, AttendanceRecordStatus> = {};
    for (const s of students) {
      const rec = fromServer?.records.find((r) => r.studentId === s.id);
      next[s.id] = rec?.status ?? "PRESENT";
    }
    setStatusById(next);
  }, [students, attendanceQuery.data]);

  const sortedFiltered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = [...students].sort((a, b) =>
      a.studentName.localeCompare(b.studentName, undefined, {
        sensitivity: "base",
      }),
    );
    if (!q) return list;
    return list.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        (s.scholarId && s.scholarId.toLowerCase().includes(q)),
    );
  }, [students, debouncedSearch]);

  const setAttendanceForStudent = useCallback(
    (studentId: string, status: AttendanceRecordStatus) => {
      setStatusById((prev) => ({
        ...prev,
        [studentId]: status,
      }));
    },
    [],
  );

  const markAll = useCallback(
    (status: AttendanceRecordStatus) => {
      setStatusById((prev) => {
        const next = { ...prev };
        for (const s of students) {
          next[s.id] = status;
        }
        return next;
      });
    },
    [students],
  );

  const markMutation = useMutation({
    mutationFn: () => {
      if (!classFilter || !sectionFilter) {
        throw new Error("Select class and section");
      }
      const records = students.map((s) => ({
        studentId: s.id,
        status: statusById[s.id] ?? "PRESENT",
      }));
      return markAttendance({
        dateKey,
        class: classFilter,
        section: sectionFilter,
        records,
      });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        [...attendanceQueryKey, dateKey, classFilter, sectionFilter],
        saved,
      );
      void queryClient.invalidateQueries({
        queryKey: attendanceQueryKey,
      });
    },
  });

  const { reset: resetMarkMutation } = markMutation;

  useEffect(() => {
    resetMarkMutation();
  }, [dateKey, classFilter, sectionFilter, resetMarkMutation]);

  const absentCount = useMemo(
    () =>
      students.filter((s) => (statusById[s.id] ?? "PRESENT") === "ABSENT")
        .length,
    [students, statusById],
  );

  const classOptions = [
    { value: SELECT_EMPTY_VALUE, label: "Class" },
    ...STUDENT_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const sectionOptions = [
    { value: SELECT_EMPTY_VALUE, label: "Section" },
    ...STUDENT_SECTION_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
    })),
  ];

  if (sessionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (sessionQuery.data?.tenant?.tenantType === "ACADEMY") {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            This screen is built for class and section rosters (school tenants).
          </p>
        </div>
        <Card className="p-6">
          <p className="text-sm text-foreground/90">
            Academy organizations use courses instead of class/section. Class
            attendance is not available here until the product supports
            course-based rosters on the server.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Mark class attendance; parents of absent students receive an SMS (once
          per day per student).
        </p>
        <div className="mt-3">
          <Link
            to="/attendance/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-primary-gradient  px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-muted"
          >
            Open attendance dashboard
          </Link>
        </div>
      </div>

      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-44 flex-1">
          <SelectField
            label="Class"
            options={classOptions}
            value={classFilter === "" ? SELECT_EMPTY_VALUE : classFilter}
            onValueChange={(v) =>
              setClassFilter(
                v === SELECT_EMPTY_VALUE ? "" : (v as StudentClass),
              )
            }
            triggerClassName="h-11 min-h-11 text-base px-4 py-2.5 [&_svg]:size-5"
            itemClassName="text-base py-2.5"
          />
        </div>
        <div className="min-w-44 flex-1">
          <SelectField
            label="Section"
            options={sectionOptions}
            value={sectionFilter === "" ? SELECT_EMPTY_VALUE : sectionFilter}
            onValueChange={(v) =>
              setSectionFilter(
                v === SELECT_EMPTY_VALUE ? "" : (v as StudentSection),
              )
            }
            triggerClassName="h-11 min-h-11 text-base px-4 py-2.5 [&_svg]:size-5"
            itemClassName="text-base py-2.5"
          />
        </div>
        <div className="min-w-48">
          <label
            htmlFor="attendance-date"
            className="mb-1.5 block text-sm font-medium text-foreground/80"
          >
            Date
          </label>
          <Input
            id="attendance-date"
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="h-11 px-4 py-2.5 text-base"
          />
        </div>
      </Card>

      {!filtersReady && (
        <p className="text-sm text-muted-foreground">
          Select a class and section to load students.
        </p>
      )}

      {rosterQuery.isError && (
        <p className="text-sm text-red-600" role="alert">
          {getErrorMessage(rosterQuery.error)}
        </p>
      )}

      {rosterTruncated && (
        <p className="text-sm text-amber-800" role="status">
          This class has more than {ROSTER_LIMIT} students; only the first page
          is loaded. Increase the limit or narrow filters on the server.
        </p>
      )}

      {filtersReady && rosterQuery.isSuccess && students.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No active students in this class and section.
        </p>
      )}

      {filtersReady && students.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <Input
                placeholder="Search name or scholar ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
                className="h-11 px-4 py-2.5 text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={!canMark}
                onClick={() => markAll("PRESENT")}
              >
                All present
              </Button>
              <Button
                type="button"
                disabled={!canMark || markMutation.isPending}
                onClick={() => canMark && setSubmitConfirmOpen(true)}
              >
                Submit attendance
              </Button>
            </div>
          </div>

          {!canMark && (
            <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              View-only access — ask a staff member to submit attendance.
            </p>
          )}

          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-sm text-muted-foreground">
            <span>
              {students.length} student{students.length === 1 ? "" : "s"} ·{" "}
              {absentCount} absent
            </span>
            {attendanceQuery.data && (
              <span className="text-xs">
                Last saved{" "}
                {new Date(attendanceQuery.data.updatedAt).toLocaleString()}
              </span>
            )}
          </div>

          <ul className="max-h-[min(28rem,70vh)] divide-y divide-border overflow-auto">
            {sortedFiltered.map((s) => {
              const st = statusById[s.id] ?? "PRESENT";
              const absent = st === "ABSENT";
              return (
                <li key={s.id}>
                  <div
                    className={cn(
                      "flex w-full items-center justify-between gap-3 py-3 pr-4 pl-3 transition-colors",
                      absent && "bg-destructive/[0.06] dark:bg-destructive/15",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">
                        {s.studentName}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.scholarId ? `Scholar ${s.scholarId}` : "—"}
                      </div>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={`Attendance for ${s.studentName}`}
                      className="flex shrink-0 items-center rounded-lg border border-border bg-muted/40 p-0.5"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!absent}
                        disabled={!canMark}
                        onClick={() => setAttendanceForStudent(s.id, "PRESENT")}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          !absent
                            ? "bg-primary text-white shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                        )}
                      >
                        Present
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={absent}
                        disabled={!canMark}
                        onClick={() => setAttendanceForStudent(s.id, "ABSENT")}
                        className={cn(
                          "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          absent
                            ? "bg-red-600 text-white shadow-sm"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                        )}
                      >
                        Absent
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {sortedFiltered.length === 0 && debouncedSearch.trim() !== "" && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No students match this search.
            </p>
          )}
        </Card>
      )}

      {markMutation.isError && (
        <p className="text-sm text-red-600" role="alert">
          {getErrorMessage(markMutation.error)}
        </p>
      )}

      {markMutation.isSuccess && (
        <p
          className="text-sm text-emerald-700 dark:text-emerald-400"
          role="status"
        >
          Attendance saved. Absent parents are notified by SMS (once per student
          per day).
        </p>
      )}

      <ConfirmationModal
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        title="Submit attendance?"
        description={
          filtersReady && classFilter && sectionFilter ? (
            <>
              <p>
                You are saving attendance for{" "}
                <strong>
                  {classFilter} · Section {sectionFilter}
                </strong>{" "}
                on <strong>{dateKey}</strong>.
              </p>
              <p className="mt-2">
                <strong>{students.length}</strong> student
                {students.length === 1 ? "" : "s"} (
                <strong>{absentCount}</strong> absent). Parents of absent
                students will be notified by SMS (once per student per day).
              </p>
            </>
          ) : (
            "Save attendance for this class?"
          )
        }
        confirmLabel="Submit"
        cancelLabel="Go back"
        isConfirming={markMutation.isPending}
        onConfirm={() => {
          markMutation.mutate(undefined, {
            onSettled: () => setSubmitConfirmOpen(false),
          });
        }}
      />
    </div>
  );
}
