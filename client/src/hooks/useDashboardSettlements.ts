import { useQuery } from '@tanstack/react-query'
import {
  getDashboardSettlements,
  type DashboardSettlementsParams,
} from '../api/dashboard.api'
import { dashboardSettlementsQueryKey } from '../constants/query-keys'

export function useDashboardSettlements(
  params?: DashboardSettlementsParams & { enabled?: boolean },
) {
  const { enabled = true, page = 1, limit = 20 } = params ?? {}
  return useQuery({
    queryKey: [...dashboardSettlementsQueryKey, page, limit] as const,
    queryFn: () => getDashboardSettlements({ page, limit }),
    enabled,
  })
}
