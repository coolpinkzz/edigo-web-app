/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin (no trailing slash), e.g. http://localhost:3000 */
  readonly VITE_API_URL: string
  /** Tenant slug for POST /auth/login (required by the backend). */
  readonly VITE_TENANT_SLUG: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
