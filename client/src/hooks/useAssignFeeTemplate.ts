import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assignTemplateToFees } from '../api/fee.api'
import { feeTemplatesQueryKey, feesQueryKey } from '../constants/query-keys'
import type { AssignTemplateToFeesPayload } from '../types'

export function useAssignFeeTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      body,
    }: {
      body: AssignTemplateToFeesPayload
    }) => assignTemplateToFees(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feeTemplatesQueryKey })
      await queryClient.invalidateQueries({ queryKey: feesQueryKey })
    },
  })
}
