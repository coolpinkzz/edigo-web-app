import { useQuery } from "@tanstack/react-query";
import {
  getAttendanceDashboardTrend,
  type AttendanceDashboardTrendParams,
} from "../api";
import { attendanceDashboardQueryKey } from "../constants/query-keys";

export function useAttendanceDashboardTrend(
  params: AttendanceDashboardTrendParams & { enabled?: boolean },
) {
  const { enabled = true, ...rest } = params;
  return useQuery({
    queryKey: [
      ...attendanceDashboardQueryKey,
      "trend",
      rest.from,
      rest.to,
      rest.class ?? "",
      rest.section ?? "",
      rest.granularity,
    ] as const,
    queryFn: () => getAttendanceDashboardTrend(rest),
    enabled,
  });
}
