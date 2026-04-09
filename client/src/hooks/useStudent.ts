import { useQuery } from '@tanstack/react-query'
import { getStudent } from '../api/student.api'
import { studentsQueryKey } from '../constants/query-keys'

export function useStudent(studentId: string | undefined) {
  return useQuery({
    queryKey: [...studentsQueryKey, studentId] as const,
    queryFn: () => getStudent(studentId!),
    enabled: Boolean(studentId),
  })
}
