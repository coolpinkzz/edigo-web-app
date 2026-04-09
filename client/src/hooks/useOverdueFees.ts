import { useQuery } from '@tanstack/react-query'
import type { ListOverdueFeesParams } from '../api/fee.api'
import { listOverdueFees } from '../api/fee.api'
import { feesOverdueQueryKey } from '../constants/query-keys'

export function useOverdueFees(
  params: ListOverdueFeesParams & { enabled?: boolean } = {},
) {
  const { enabled = true, ...listParams } = params
  return useQuery({
    queryKey: [...feesOverdueQueryKey, listParams] as const,
    queryFn: () => listOverdueFees(listParams),
    enabled,
  })
}
