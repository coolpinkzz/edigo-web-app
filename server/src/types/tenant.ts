/** How the organization structures students (drives class/section vs course UI). */
export const TENANT_TYPES = ["SCHOOL", "ACADEMY"] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

export function isTenantType(value: unknown): value is TenantType {
  return (
    typeof value === "string" &&
    (TENANT_TYPES as readonly string[]).includes(value)
  );
}
