import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateFeePayment } from "../api/fee.api";
import { dashboardOverviewQueryKey, feesQueryKey } from "../constants/query-keys";
import type { UpdateFeePaymentPayload } from "../types";

export function useUpdateFeePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      feeId,
      body,
    }: {
      feeId: string;
      body: UpdateFeePaymentPayload;
    }) => updateFeePayment(feeId, body),
    onSuccess: async (_, { feeId }) => {
      await queryClient.invalidateQueries({ queryKey: feesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: [...feesQueryKey, "detail", feeId],
      });
      await queryClient.invalidateQueries({ queryKey: dashboardOverviewQueryKey });
    },
  });
}
