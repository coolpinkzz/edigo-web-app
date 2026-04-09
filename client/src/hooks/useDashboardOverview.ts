import { useQuery } from '@tanstack/react-query'
import {
  getDashboardOverview,
  type DashboardOverviewParams,
} from '../api/dashboard.api'
import { dashboardOverviewQueryKey } from '../constants/query-keys'

export function useDashboardOverview(
  params: DashboardOverviewParams & { enabled?: boolean },
) {
  const { enabled = true, ...overviewParams } = params
  return useQuery({
    queryKey: [
      ...dashboardOverviewQueryKey,
      overviewParams.from.toISOString(),
      overviewParams.to.toISOString(),
      overviewParams.compare ?? false,
    ] as const,
    queryFn: () => getDashboardOverview(overviewParams),
    enabled,
  })
}
