import { useQuery } from "@tanstack/react-query";
import { getClassPerformance } from "../api/dashboard.api";
import { dashboardClassPerformanceQueryKey } from "../constants/query-keys";
import { useAuthSession } from "./useAuthSession";

export function useDashboardClassPerformance(enabled = true) {
  const sessionQuery = useAuthSession();
  const tenantType = sessionQuery.data?.tenant?.tenantType ?? "SCHOOL";

  return useQuery({
    queryKey: [...dashboardClassPerformanceQueryKey, tenantType] as const,
    queryFn: () => getClassPerformance(),
    enabled: enabled && sessionQuery.isSuccess,
  });
}
