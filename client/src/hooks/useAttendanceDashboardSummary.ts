import { useQuery } from "@tanstack/react-query";
import {
  getAttendanceDashboardSummary,
  type AttendanceDashboardSummaryParams,
} from "../api";
import { attendanceDashboardQueryKey } from "../constants/query-keys";

export function useAttendanceDashboardSummary(
  params: AttendanceDashboardSummaryParams & { enabled?: boolean },
) {
  const { enabled = true, ...rest } = params;
  return useQuery({
    queryKey: [
      ...attendanceDashboardQueryKey,
      "summary",
      rest.from,
      rest.to,
      rest.class ?? "",
      rest.section ?? "",
    ] as const,
    queryFn: () => getAttendanceDashboardSummary(rest),
    enabled,
  });
}
