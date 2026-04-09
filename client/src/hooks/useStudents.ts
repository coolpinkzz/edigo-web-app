import { useQuery } from '@tanstack/react-query'
import type { ListStudentsParams } from '../api/student.api'
import { listStudents } from '../api/student.api'
import { studentsQueryKey } from '../constants/query-keys'

export function useStudents(
  params: ListStudentsParams = {},
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: [...studentsQueryKey, params] as const,
    queryFn: () => listStudents(params),
    enabled: options?.enabled ?? true,
  });
}
