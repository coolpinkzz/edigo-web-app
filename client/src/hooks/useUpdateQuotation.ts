import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateQuotation } from "../api/quotation.api";
import { quotationsQueryKey } from "../constants/query-keys";

export function useUpdateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof updateQuotation>[1];
    }) => updateQuotation(id, body),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: quotationsQueryKey });
      void qc.invalidateQueries({ queryKey: [...quotationsQueryKey, id] });
    },
  });
}
