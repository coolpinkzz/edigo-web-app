import { env } from "../constants";
import type { AuthMeResponse, LoginApiPayload, LoginRequest, LoginResponse } from "../types";
import { apiClient } from "./client";

/**
 * POST /auth/login
 * Sends `{ phone, password }` from the form plus `tenantSlug` (from `VITE_TENANT_SLUG`),
 * which the backend requires for multi-tenant auth.
 */
export async function login(body: LoginRequest): Promise<LoginResponse> {
  const tenantSlug = env.tenantSlug.trim();
  if (!tenantSlug) {
    throw new Error(
      "Tenant is not configured. Set VITE_TENANT_SLUG in your .env file.",
    );
  }

  const payload: LoginApiPayload = {
    ...body,
    tenantSlug,
  };

  const { data } = await apiClient.post<LoginResponse>("/auth/login", payload);
  return data;
}

/** GET /auth/me — session + tenant type (SCHOOL vs ACADEMY). */
export async function getAuthMe(): Promise<AuthMeResponse> {
  const { data } = await apiClient.get<AuthMeResponse>("/auth/me");
  return data;
}
