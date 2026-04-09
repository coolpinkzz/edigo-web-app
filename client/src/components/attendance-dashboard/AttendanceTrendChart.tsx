import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AttendanceDashboardTrendDto } from "../../types";

const attendanceStroke = "var(--color-primary)";
const absentStroke = "#dc2626";

export function AttendanceTrendChart({
  data,
  loading,
  errorMessage,
}: {
  data?: AttendanceDashboardTrendDto;
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

  if (loading) {
    return (
      <div
        className="flex h-[300px] items-center justify-center rounded-lg bg-muted/30"
        aria-busy
      >
        <p className="text-sm text-muted-foreground">Loading chart…</p>
      </div>
    );
  }

  const points =
    data?.points.map((p) => ({
      label: p.label,
      attendancePercent: p.attendancePercent,
      absentCount: p.absentCount,
    })) ?? [];

  if (!points.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg bg-muted/20">
        <p className="text-sm text-muted-foreground">No attendance data in this range.</p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            yAxisId="pct"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            width={56}
          />
          <YAxis yAxisId="count" orientation="right" hide />
          <Tooltip
            formatter={(value, name) =>
              name === "Attendance %"
                ? [`${Number(value).toFixed(1)}%`, name]
                : [String(Math.round(Number(value))), name]
            }
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line
            yAxisId="pct"
            type="monotone"
            dataKey="attendancePercent"
            name="Attendance %"
            stroke={attendanceStroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="count"
            type="monotone"
            dataKey="absentCount"
            name="Absent count"
            stroke={absentStroke}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
