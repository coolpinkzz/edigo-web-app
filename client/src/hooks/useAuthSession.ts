import { useQuery } from "@tanstack/react-query";
import { getAuthMe } from "../api/auth.api";
import { STORAGE_ACCESS_TOKEN } from "../constants";
import { authMeQueryKey } from "../constants/query-keys";
import type { AuthMeResponse } from "../types";

/**
 * Current user + tenant (including `tenantType` for SCHOOL vs ACADEMY UI).
 */
export function useAuthSession() {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_ACCESS_TOKEN)
      : null;

  return useQuery({
    queryKey: authMeQueryKey,
    queryFn: (): Promise<AuthMeResponse> => getAuthMe(),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });
}
