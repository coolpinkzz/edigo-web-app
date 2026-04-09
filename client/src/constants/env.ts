/**
 * Resolved client env (Vite exposes only `VITE_*` vars).
 * Defaults align with the Express server in this repo (`PORT` default 3000).
 */
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  /** Backend requires tenant slug on login; set in `.env` for your deployment. */
  tenantSlug: import.meta.env.VITE_TENANT_SLUG ?? '',
} as const
