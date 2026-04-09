import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteStudent } from '../api/student.api'
import { studentsQueryKey } from '../constants/query-keys'

export function useDeleteStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (studentId: string) => deleteStudent(studentId),
    onSuccess: async (_, studentId) => {
      await queryClient.invalidateQueries({ queryKey: studentsQueryKey })
      await queryClient.removeQueries({
        queryKey: [...studentsQueryKey, studentId],
      })
    },
  })
}
