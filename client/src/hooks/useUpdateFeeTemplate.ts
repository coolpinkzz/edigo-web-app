import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFeeTemplate } from "../api/template.api";
import { feeTemplatesQueryKey } from "../constants/query-keys";
import type { CreateFeeTemplateFormValues } from "../types";

export function useUpdateFeeTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      values,
    }: {
      templateId: string;
      values: CreateFeeTemplateFormValues;
    }) => updateFeeTemplate(templateId, values),
    onSuccess: async (_data, { templateId }) => {
      await queryClient.invalidateQueries({ queryKey: feeTemplatesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: [...feeTemplatesQueryKey, templateId],
      });
    },
  });
}
