import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/auth.api";
import { STORAGE_ACCESS_TOKEN } from "../constants";
import { authMeQueryKey } from "../constants/query-keys";
import type { LoginRequest } from "../types";

/**
 * Login mutation: calls API, persists JWT as `accessToken`, navigates to dashboard
 * (or back to the protected route that triggered login).
 */
export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequest) => login(credentials),
    onSuccess: (data) => {
      localStorage.setItem(STORAGE_ACCESS_TOKEN, data.token);
      void queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      const fromPath = (
        location.state as { from?: { pathname?: string } } | null
      )?.from?.pathname;
      const safeReturn =
        fromPath &&
        fromPath !== "/login" &&
        fromPath !== "/forgot-password" &&
        fromPath !== "/"
          ? fromPath
          : "/dashboard";
      navigate(safeReturn, { replace: true });
    },
  });
}
