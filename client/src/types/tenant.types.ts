/** Mirrors server `types/tenant.ts` / `Tenant.tenantType`. */
export type TenantType = "SCHOOL" | "ACADEMY";

/** GET /auth/me — JWT claims + tenant metadata. */
export interface AuthMeResponse {
  user: {
    userId: string;
    tenantId: string;
    role: string;
    phone: string;
    name?: string;
  };
  tenant: {
    name: string;
    tenantType: TenantType;
  };
}
