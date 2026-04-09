import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AttendanceKpiCards,
  AttendanceTrendChart,
} from "../components/attendance-dashboard";
import { Card, Input, SELECT_EMPTY_VALUE, SelectField } from "../components/ui";
import { useAttendanceDashboardSummary } from "../hooks/useAttendanceDashboardSummary";
import { useAttendanceDashboardTrend } from "../hooks/useAttendanceDashboardTrend";
import {
  STUDENT_CLASS_OPTIONS,
  STUDENT_SECTION_OPTIONS,
  type StudentClass,
  type StudentSection,
} from "../types";
import { getErrorMessage } from "../utils";

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStartDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function AttendanceDashboardPage() {
  const [classFilter, setClassFilter] = useState<StudentClass | "">("");
  const [sectionFilter, setSectionFilter] = useState<StudentSection | "">("");
  const [fromDate, setFromDate] = useState(monthStartDateKey);
  const [toDate, setToDate] = useState(todayDateKey);

  const filtersReady = Boolean(classFilter && sectionFilter);
  const granularity = "daily" as const;

  const summaryQuery = useAttendanceDashboardSummary({
    from: fromDate,
    to: toDate,
    class: classFilter || undefined,
    section: sectionFilter || undefined,
    enabled: filtersReady,
  });

  const trendQuery = useAttendanceDashboardTrend({
    from: fromDate,
    to: toDate,
    class: classFilter || undefined,
    section: sectionFilter || undefined,
    granularity,
    enabled: filtersReady,
  });

  const classOptions = [
    { value: SELECT_EMPTY_VALUE, label: "Class" },
    ...STUDENT_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  const sectionOptions = [
    { value: SELECT_EMPTY_VALUE, label: "Section" },
    ...STUDENT_SECTION_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Attendance dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Track attendance trends and inspect student-level records.
          </p>
        </div>
        <Link
          to="/attendance"
          className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Go to marking screen
        </Link>
      </div>

      <Card className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
        <SelectField
          label="Class"
          options={classOptions}
          value={classFilter === "" ? SELECT_EMPTY_VALUE : classFilter}
          onValueChange={(v) =>
            setClassFilter(v === SELECT_EMPTY_VALUE ? "" : (v as StudentClass))
          }
        />
        <SelectField
          label="Section"
          options={sectionOptions}
          value={sectionFilter === "" ? SELECT_EMPTY_VALUE : sectionFilter}
          onValueChange={(v) =>
            setSectionFilter(
              v === SELECT_EMPTY_VALUE ? "" : (v as StudentSection),
            )
          }
        />
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-foreground/80"
            htmlFor="from-date"
          >
            From
          </label>
          <Input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-foreground/80"
            htmlFor="to-date"
          >
            To
          </label>
          <Input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </Card>

      {!filtersReady && (
        <p className="text-sm text-muted-foreground">
          Select class and section to load attendance dashboard.
        </p>
      )}

      <AttendanceKpiCards
        data={summaryQuery.data}
        loading={filtersReady && summaryQuery.isLoading}
        errorMessage={
          filtersReady && summaryQuery.isError
            ? getErrorMessage(summaryQuery.error)
            : null
        }
      />

      <Card className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          Attendance trend
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Daily attendance percentage and absent count.
        </p>
        <div className="mt-4">
          <AttendanceTrendChart
            data={trendQuery.data}
            loading={filtersReady && trendQuery.isLoading}
            errorMessage={
              filtersReady && trendQuery.isError
                ? getErrorMessage(trendQuery.error)
                : null
            }
          />
        </div>
      </Card>
    </div>
  );
}
