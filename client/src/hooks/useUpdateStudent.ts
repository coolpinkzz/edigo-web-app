import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { updateStudent, uploadStudentPhotoAndGetUrl } from "../api/student.api";
import { authMeQueryKey, studentsQueryKey } from "../constants/query-keys";
import type { AuthMeResponse, CreateStudentFormValues } from "../types";

export function useUpdateStudent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      studentId,
      values,
      photoFile,
    }: {
      studentId: string;
      values: CreateStudentFormValues;
      photoFile?: File | null;
    }) => {
      const me = queryClient.getQueryData<AuthMeResponse>(authMeQueryKey);
      const tenantType = me?.tenant?.tenantType ?? "SCHOOL";
      if (photoFile) {
        const url = await uploadStudentPhotoAndGetUrl(studentId, photoFile);
        return updateStudent(studentId, { ...values, photoUrl: url }, tenantType);
      }
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
