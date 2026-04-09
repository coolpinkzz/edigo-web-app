import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createStudent } from "../api/student.api";
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
};

export function useCreateStudent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      values,
      feeTemplateIsInstallment,
    }: CreateStudentMutationInput) => {
      const me = queryClient.getQueryData<AuthMeResponse>(authMeQueryKey);
      const tenantType = me?.tenant?.tenantType ?? "SCHOOL";
      return createStudent(values, tenantType, { feeTemplateIsInstallment });
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
