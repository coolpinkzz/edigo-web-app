import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { signupTenant } from "../api/auth.api";
import { STORAGE_ACCESS_TOKEN } from "../constants";
import { authMeQueryKey } from "../constants/query-keys";
import type { SignupTenantBody } from "../types";

export interface TenantSignupFormValues extends SignupTenantBody {
  /** Sent as `X-Signup-Key` when provided; not part of JSON body. */
  signupApiKey?: string;
}

/**
 * Creates a new tenant + admin user, stores JWT, redirects to dashboard.
 */
export function useTenantSignup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: TenantSignupFormValues) => {
      const { signupApiKey, ...body } = values;
      return signupTenant(body, signupApiKey);
    },
    onSuccess: (data) => {
      localStorage.setItem(STORAGE_ACCESS_TOKEN, data.token);
      void queryClient.invalidateQueries({ queryKey: authMeQueryKey });
      navigate("/dashboard", { replace: true });
    },
  });
}
