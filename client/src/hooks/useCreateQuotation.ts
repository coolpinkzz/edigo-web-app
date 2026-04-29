import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createQuotation } from "../api/quotation.api";
import { quotationsQueryKey } from "../constants/query-keys";

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuotation,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: quotationsQueryKey });
    },
  });
}
