import { useQuery } from '@tanstack/react-query'
import type { StudentFeeOverviewParams } from '../api/student.api'
import { getStudentFeeOverview } from '../api/student.api'
import { studentsFeeOverviewQueryKey } from '../constants/query-keys'

export function useStudentFeeOverview(
  params: StudentFeeOverviewParams & { enabled?: boolean } = {},
) {
  const { enabled = true, ...listParams } = params
  return useQuery({
    queryKey: [...studentsFeeOverviewQueryKey, listParams] as const,
    queryFn: () => getStudentFeeOverview(listParams),
    enabled,
  })
}
