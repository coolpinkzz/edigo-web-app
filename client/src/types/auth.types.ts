import type { TenantType } from "./tenant.types";

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

/** Optional campus row for POST /auth/signup. */
export interface SignupBranchInput {
  name: string;
  code?: string;
  address?: string;
}

/** JSON body for POST /auth/signup (tenant onboarding). */
export interface SignupTenantBody {
  tenantName: string;
  tenantSlug: string;
  tenantType: TenantType;
  phone: string;
  password: string;
  name: string;
  branches?: SignupBranchInput[];
}

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
