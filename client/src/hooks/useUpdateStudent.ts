import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { updateStudent } from "../api/student.api";
import { authMeQueryKey, studentsQueryKey } from "../constants/query-keys";
import type { AuthMeResponse, CreateStudentFormValues } from "../types";

export function useUpdateStudent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      studentId,
      values,
    }: {
      studentId: string;
      values: CreateStudentFormValues;
    }) => {
      const me = queryClient.getQueryData<AuthMeResponse>(authMeQueryKey);
      const tenantType = me?.tenant?.tenantType ?? "SCHOOL";
      return updateStudent(studentId, values, tenantType);
    },
    onSuccess: async (_, { studentId }) => {
      await queryClient.invalidateQueries({ queryKey: studentsQueryKey });
      await queryClient.invalidateQueries({
        queryKey: [...studentsQueryKey, studentId],
      });
      navigate("/students?updated=1", { replace: true });
    },
  });
}
