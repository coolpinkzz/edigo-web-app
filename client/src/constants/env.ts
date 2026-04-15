/**
 * Resolved client env (Vite exposes only `VITE_*` vars).
 * Defaults align with the Express server in this repo (`PORT` default 3000).
 */
const tenantRootFromEnv = import.meta.env.VITE_TENANT_ROOT_DOMAIN?.trim() ?? "";

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  /** Backend requires tenant slug on login; used in development and as a fallback in production. */
  tenantSlug: import.meta.env.VITE_TENANT_SLUG ?? "",
  /**
   * Production apex for tenant subdomains (`academy.edigo.in` → slug `academy`).
   * Defaults to `edigo.in` in production builds; override with `VITE_TENANT_ROOT_DOMAIN` if needed.
   */
  tenantRootDomain:
    tenantRootFromEnv || (import.meta.env.PROD ? "edigo.in" : ""),
  /** GA4 ID; empty disables analytics. Loaded only from `LandingPage`. */
  gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID?.trim() ?? "",
} as const;
