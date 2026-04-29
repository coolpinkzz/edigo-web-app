import { useQuery } from "@tanstack/react-query";
import { getQuotation } from "../api/quotation.api";
import { quotationsQueryKey } from "../constants/query-keys";

export function useQuotation(id: string | undefined) {
  return useQuery({
    queryKey: [...quotationsQueryKey, id] as const,
    queryFn: () => getQuotation(id!),
    enabled: Boolean(id),
  });
}
