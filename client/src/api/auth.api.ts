import type {
  AuthMeResponse,
  CreateRazorpayLinkedAccountBody,
  CreateRazorpayLinkedAccountResponse,
  LoginApiPayload,
  LoginRequest,
  LoginResponse,
  PatchTenantResponse,
  PasswordResetMessageResponse,
  RazorpayRouteSettlementsBody,
  RazorpayRouteSettlementsResponse,
  SignupTenantBody,
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

/**
 * POST /auth/signup — create tenant + admin; optional `X-Signup-Key` when server sets SIGNUP_API_KEY.
 */
export async function signupTenant(
  body: SignupTenantBody,
  signupApiKey: string | undefined,
): Promise<LoginResponse> {
  const headers: Record<string, string> = {};
  const key = signupApiKey?.trim();
  if (key) {
    headers["X-Signup-Key"] = key;
  }
  const { data } = await apiClient.post<LoginResponse>("/auth/signup", body, {
    headers,
  });
  return data;
}

/** GET /auth/me — session + tenant type (SCHOOL vs ACADEMY). */
export async function getAuthMe(): Promise<AuthMeResponse> {
  const { data } = await apiClient.get<AuthMeResponse>("/auth/me");
  return data;
}

const TENANT_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Max org logo size (must match server presign). */
export const TENANT_LOGO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * S3 presign + PUT, then return public URL. Caller should PATCH /auth/tenant
 * with `logoUrl` (see `useMutation` in Settings that chains `patchTenant`).
 */
export async function uploadTenantLogoAndGetUrl(
  file: File,
): Promise<string> {
  if (file.size > TENANT_LOGO_MAX_BYTES) {
    throw new Error("Image must be at most 5 MB.");
  }
  const contentType = file.type;
  if (!TENANT_LOGO_TYPES.has(contentType)) {
    throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  }
  const { data } = await apiClient.post<{
    uploadUrl: string;
    publicUrl: string;
    expiresIn: number;
    maxBytes: number;
  }>("/auth/tenant/logo/presign", { contentType });
  const res = await fetch(data.uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(
      "Could not upload the image. Check storage (AWS S3) settings or try again.",
    );
  }
  return data.publicUrl;
}

/** PATCH /auth/tenant — tenant admin: organization name and/or logo. */
export async function patchTenant(body: {
  name?: string;
  logoUrl?: string | null;
}): Promise<PatchTenantResponse> {
  const { data } = await apiClient.patch<PatchTenantResponse>(
    "/auth/tenant",
    body,
  );
  return data;
}

/** POST /auth/razorpay-linked-account — tenant admin: Razorpay Route linked account. */
export async function createRazorpayLinkedAccount(
  body: CreateRazorpayLinkedAccountBody,
): Promise<CreateRazorpayLinkedAccountResponse> {
  const { data } = await apiClient.post<CreateRazorpayLinkedAccountResponse>(
    "/auth/razorpay-linked-account",
    body,
  );
  return data;
}

/** POST /auth/razorpay-route-settlements — Route product + settlement bank (server-only). */
export async function createRazorpayRouteSettlements(
  body: RazorpayRouteSettlementsBody,
): Promise<RazorpayRouteSettlementsResponse> {
  const { data } = await apiClient.post<RazorpayRouteSettlementsResponse>(
    "/auth/razorpay-route-settlements",
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
