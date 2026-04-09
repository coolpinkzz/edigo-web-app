import { useQuery } from '@tanstack/react-query'
import { listFeeTemplates } from '../api/template.api'
import type { ListFeeTemplatesParams } from '../api/template.api'
import { feeTemplatesQueryKey } from '../constants/query-keys'

export function useFeeTemplates(
  params: ListFeeTemplatesParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...feeTemplatesQueryKey, params] as const,
    queryFn: () => listFeeTemplates(params),
    enabled: options?.enabled ?? true,
  })
}
