import { useQuery } from '@tanstack/react-query'
import type { ListFeesParams } from '../api/fee.api'
import { listFees } from '../api/fee.api'
import { feesQueryKey } from '../constants/query-keys'

export function useFees(
  params: ListFeesParams & { enabled?: boolean } = {},
) {
  const { enabled = true, ...listParams } = params
  return useQuery({
    queryKey: [...feesQueryKey, listParams] as const,
    queryFn: () => listFees(listParams),
    enabled,
  })
}
