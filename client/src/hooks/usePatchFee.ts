import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchFee } from "../api/fee.api";
import {
  dashboardOverviewQueryKey,
  feesQueryKey,
  studentsFeeOverviewQueryKey,
} from "../constants/query-keys";
import type { PatchFeePayload } from "../types";

export function usePatchFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      feeId,
      body,
    }: {
      feeId: string;
      body: PatchFeePayload;
    }) => patchFee(feeId, body),
    onSuccess: async (_, { feeId }) => {
      await queryClient.invalidateQueries({ queryKey: feesQueryKey });
      await queryClient.invalidateQueries({
        queryKey: [...feesQueryKey, "detail", feeId],
      });
      await queryClient.invalidateQueries({
        queryKey: studentsFeeOverviewQueryKey,
      });
      await queryClient.invalidateQueries({
        queryKey: dashboardOverviewQueryKey,
      });
    },
  });
}
