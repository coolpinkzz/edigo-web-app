import { useQuery } from "@tanstack/react-query";
import { listBranches } from "../api/branch.api";
import { branchesQueryKey } from "../constants/query-keys";

export function useBranches(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: branchesQueryKey,
    queryFn: listBranches,
    enabled: options?.enabled ?? true,
  });
}
