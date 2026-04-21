import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  createStudent,
  updateStudent,
  uploadStudentPhotoAndGetUrl,
} from "../api/student.api";
import {
  authMeQueryKey,
  feesQueryKey,
  studentsFeeOverviewQueryKey,
  studentsQueryKey,
} from "../constants/query-keys";
import type { AuthMeResponse, CreateStudentFormValues } from "../types";

export type CreateStudentMutationInput = {
  values: CreateStudentFormValues;
  /** Mirrors selected fee template; controls which optional fee fields are sent. */
  feeTemplateIsInstallment?: boolean;
  /** When set, uploaded to S3 after the student row exists, then PATCH saves `photoUrl`. */
  photoFile?: File | null;
};

export function useCreateStudent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      values,
      feeTemplateIsInstallment,
      photoFile,
    }: CreateStudentMutationInput) => {
      const me = queryClient.getQueryData<AuthMeResponse>(authMeQueryKey);
      const tenantType = me?.tenant?.tenantType ?? "SCHOOL";
      const created = await createStudent(values, tenantType, {
        feeTemplateIsInstallment,
      });
      if (photoFile) {
        const url = await uploadStudentPhotoAndGetUrl(created.id, photoFile);
        return updateStudent(
          created.id,
          { ...values, photoUrl: url },
          tenantType,
        );
      }
      return created;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: studentsQueryKey });
      await queryClient.invalidateQueries({ queryKey: feesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: studentsFeeOverviewQueryKey,
      });
      if (data.feeFromTemplate) {
        navigate(`/students/${data.id}`, { replace: true });
      } else {
        navigate("/students?created=1", { replace: true });
      }
    },
  });
}
