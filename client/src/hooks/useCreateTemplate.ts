import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFeeTemplate } from '../api/template.api'
import { feeTemplatesQueryKey } from '../constants/query-keys'
import type { CreateFeeTemplateFormValues } from '../types'

/**
 * Creates a fee structure. Caller can continue the flow (e.g. assign on the same page).
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: CreateFeeTemplateFormValues) => createFeeTemplate(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: feeTemplatesQueryKey })
    },
  })
}
