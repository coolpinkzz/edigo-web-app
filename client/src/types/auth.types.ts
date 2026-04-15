/**
 * Login form values (what the user enters).
 * Matches POST /auth/login body shape for phone + password.
 */
export interface LoginRequest {
  phone: string
  password: string
}

/**
 * Full payload sent to the API (backend also requires tenantSlug).
 */
export interface LoginApiPayload extends LoginRequest {
  tenantSlug: string
}

import type { TenantType } from "./tenant.types";

/** Response from POST /auth/login (server returns `token`). */
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    name: string;
    tenantId: string;
    role: string;
    tenantType: TenantType;
  };
}

/** Generic `{ message }` from forgot-password OTP and reset endpoints. */
export interface PasswordResetMessageResponse {
  message: string;
}
