import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteFeeTemplate } from '../api/template.api'
import { feeTemplatesQueryKey } from '../constants/query-keys'

export function useDeleteFeeTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (templateId: string) => deleteFeeTemplate(templateId),
    onSuccess: async (_, templateId) => {
      await queryClient.invalidateQueries({ queryKey: feeTemplatesQueryKey })
      await queryClient.removeQueries({
        queryKey: [...feeTemplatesQueryKey, templateId],
      })
    },
  })
}
