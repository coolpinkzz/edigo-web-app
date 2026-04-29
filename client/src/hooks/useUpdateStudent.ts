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
      includeBranchInApiPayload,
    }: {
      studentId: string;
      values: CreateStudentFormValues;
      photoFile?: File | null;
      includeBranchInApiPayload?: boolean;
    }) => {
      const me = queryClient.getQueryData<AuthMeResponse>(authMeQueryKey);
      const tenantType = me?.tenant?.tenantType ?? "SCHOOL";
      const patchOpts = { includeBranchInApiPayload };
      if (photoFile) {
        const url = await uploadStudentPhotoAndGetUrl(studentId, photoFile);
        return updateStudent(
          studentId,
          { ...values, photoUrl: url },
          tenantType,
          patchOpts,
        );
      }
      return updateStudent(studentId, values, tenantType, patchOpts);
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
