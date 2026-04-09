import { useQuery } from '@tanstack/react-query'
import { getFeeTemplate } from '../api/template.api'
import { feeTemplatesQueryKey } from '../constants/query-keys'

export function useFeeTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: [...feeTemplatesQueryKey, templateId] as const,
    queryFn: () => getFeeTemplate(templateId!),
    enabled: Boolean(templateId),
  })
}
