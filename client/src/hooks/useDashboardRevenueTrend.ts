import { useQuery } from '@tanstack/react-query'
import {
  getRevenueTrend,
  type RevenueTrendParams,
} from '../api/dashboard.api'
import { dashboardRevenueTrendQueryKey } from '../constants/query-keys'

export function useDashboardRevenueTrend(
  params: RevenueTrendParams & { enabled?: boolean },
) {
  const { enabled = true, ...rest } = params
  return useQuery({
    queryKey: [
      ...dashboardRevenueTrendQueryKey,
      rest.from.toISOString(),
      rest.to.toISOString(),
      rest.granularity,
    ] as const,
    queryFn: () => getRevenueTrend(rest),
    enabled,
  })
}
