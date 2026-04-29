import { useQuery } from "@tanstack/react-query";
import { listQuotations, type ListQuotationsParams } from "../api/quotation.api";
import { quotationsQueryKey } from "../constants/query-keys";

export function useQuotations(params?: ListQuotationsParams) {
  return useQuery({
    queryKey: [...quotationsQueryKey, params ?? {}] as const,
    queryFn: () => listQuotations(params),
  });
}
