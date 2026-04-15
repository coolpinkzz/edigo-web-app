import type {
  AuthMeResponse,
  LoginApiPayload,
  LoginRequest,
  LoginResponse,
  PatchTenantResponse,
  PasswordResetMessageResponse,
} from "../types";
import { getTenantSlug } from "../utils/tenantSlug";
import { apiClient } from "./client";

function requireTenantSlug(): string {
  const tenantSlug = getTenantSlug().trim();
  if (!tenantSlug) {
    throw new Error(
      "Tenant is not configured. In development set VITE_TENANT_SLUG. In production deploy on a tenant subdomain or set VITE_TENANT_SLUG / VITE_TENANT_ROOT_DOMAIN.",
    );
  }
  return tenantSlug;
}

/**
 * POST /auth/login
 * Sends `{ phone, password }` plus `tenantSlug` (dev: `VITE_TENANT_SLUG`; prod: subdomain when applicable).
 */
export async function login(body: LoginRequest): Promise<LoginResponse> {
  const tenantSlug = requireTenantSlug();

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

/** PATCH /auth/tenant — tenant admin: organization display name. */
export async function patchTenant(body: {
  name: string;
}): Promise<PatchTenantResponse> {
  const { data } = await apiClient.patch<PatchTenantResponse>(
    "/auth/tenant",
    body,
  );
  return data;
}

/** POST /auth/request-otp */
export async function requestPasswordResetOtp(body: {
  phone: string;
}): Promise<PasswordResetMessageResponse> {
  const tenantSlug = requireTenantSlug();
  const { data } = await apiClient.post<PasswordResetMessageResponse>(
    "/auth/request-otp",
    { phone: body.phone, tenantSlug },
  );
  return data;
}

/** POST /auth/verify-otp */
export async function verifyPasswordResetOtp(body: {
  phone: string;
  otp: string;
}): Promise<PasswordResetMessageResponse> {
  const tenantSlug = requireTenantSlug();
  const { data } = await apiClient.post<PasswordResetMessageResponse>(
    "/auth/verify-otp",
    { phone: body.phone, otp: body.otp, tenantSlug },
  );
  return data;
}

/** POST /auth/reset-password */
export async function resetPasswordAfterOtp(body: {
  phone: string;
  newPassword: string;
}): Promise<PasswordResetMessageResponse> {
  const tenantSlug = requireTenantSlug();
  const { data } = await apiClient.post<PasswordResetMessageResponse>(
    "/auth/reset-password",
    { phone: body.phone, newPassword: body.newPassword, tenantSlug },
  );
  return data;
}
