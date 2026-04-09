import { Card } from "../ui";
import type { AttendanceDashboardSummaryDto } from "../../types";

export function AttendanceKpiCards({
  data,
  loading,
  errorMessage,
}: {
  data?: AttendanceDashboardSummaryDto;
  loading: boolean;
  errorMessage?: string | null;
}) {
  if (errorMessage) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {errorMessage}
      </p>
    );
  }

  const sessions = data?.totals.sessions ?? 0;
  const studentsMarked = data?.totals.studentsMarked ?? 0;
  const presentCount = data?.totals.presentCount ?? 0;
  const absentCount = data?.totals.absentCount ?? 0;
  const percent = data?.totals.attendancePercent ?? 0;

  const valueOrDash = (v: number) => (loading ? "—" : v.toLocaleString());

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4 bg-primary-gradient text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-wide">Sessions</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {valueOrDash(sessions)}
        </p>
      </Card>
      <Card className="p-4 bg-primary-gradient text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-wide">
          Students marked
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {valueOrDash(studentsMarked)}
        </p>
      </Card>
      <Card className="p-4 bg-primary-gradient text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-wide">Present</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {valueOrDash(presentCount)}
        </p>
      </Card>
      <Card className="p-4 bg-primary-gradient text-primary-foreground">
        <p className="text-xs font-medium uppercase tracking-wide">Absent</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {valueOrDash(absentCount)}
        </p>
        <p className="mt-2 text-xs">
          Attendance rate {loading ? "—" : `${percent.toFixed(1)}%`}
        </p>
      </Card>
    </div>
  );
}
