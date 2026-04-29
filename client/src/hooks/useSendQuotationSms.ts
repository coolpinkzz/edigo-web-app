import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendQuotationPdfSms } from "../api/quotation.api";
import { quotationsQueryKey } from "../constants/query-keys";

export function useSendQuotationSms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendQuotationPdfSms,
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: quotationsQueryKey });
      void qc.invalidateQueries({ queryKey: [...quotationsQueryKey, id] });
    },
  });
}
