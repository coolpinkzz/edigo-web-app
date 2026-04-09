import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateInstallment } from '../api/fee.api'
import { dashboardOverviewQueryKey, feesQueryKey } from '../constants/query-keys'
import type { UpdateInstallmentPayload } from '../types'

export function useUpdateInstallment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      feeId,
      installmentId,
      body,
    }: {
      feeId: string
      installmentId: string
      body: UpdateInstallmentPayload
    }) => updateInstallment(feeId, installmentId, body),
    onSuccess: async (_, { feeId }) => {
      await queryClient.invalidateQueries({ queryKey: feesQueryKey })
      await queryClient.invalidateQueries({
        queryKey: [...feesQueryKey, 'detail', feeId],
      })
      await queryClient.invalidateQueries({ queryKey: dashboardOverviewQueryKey })
    },
  })
}
