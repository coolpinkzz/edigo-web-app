/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin (no trailing slash), e.g. http://localhost:3000 */
  readonly VITE_API_URL: string
  /** Tenant slug for auth in development; optional fallback in production if subdomain cannot be resolved. */
  readonly VITE_TENANT_SLUG: string
  /** Production: apex host (e.g. edigo.in) so `slug` is parsed from `slug.edigo.in`. */
  readonly VITE_TENANT_ROOT_DOMAIN?: string
  /** Google Analytics 4 measurement ID (G-XXXXXXXXXX). Used on the marketing landing page only. */
  readonly VITE_GA_MEASUREMENT_ID?: string
}

interface Window {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
