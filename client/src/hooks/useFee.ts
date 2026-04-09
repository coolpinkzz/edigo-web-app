import { useQuery } from '@tanstack/react-query'
import { getFee } from '../api/fee.api'
import { feesQueryKey } from '../constants/query-keys'

export function useFee(feeId: string | undefined) {
  return useQuery({
    queryKey: [...feesQueryKey, 'detail', feeId] as const,
    queryFn: () => getFee(feeId!),
    enabled: Boolean(feeId),
  })
}
