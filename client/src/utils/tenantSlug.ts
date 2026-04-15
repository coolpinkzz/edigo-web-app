import { env } from '../constants'

/** Hosted previews — do not treat the first label as a tenant slug. */
const PREVIEW_HOST =
  /\.(vercel|netlify|cloudflarepages|github)\.app$/i

function slugFromRootDomain(hostname: string, root: string): string | null {
  const r = root.replace(/^\./, '').toLowerCase()
  const h = hostname.toLowerCase()
  if (h === r || h === `www.${r}`) return null
  const escaped = r.replace(/\./g, '\\.')
  const m = new RegExp(`^([^.]+)\\.${escaped}$`).exec(h)
  return m?.[1] ?? null
}

function slugFromHeuristic(hostname: string): string | null {
  if (PREVIEW_HOST.test(hostname)) return null
  if (hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return null
  }
  const parts = hostname.split('.').filter(Boolean)
  if (parts.length < 3) return null
  if (parts[0] === 'www') return null
  return parts[0] ?? null
}

/**
 * Development: `VITE_TENANT_SLUG` only.
 * Production: tenant from subdomain (`academy.example.com` → `academy`), then env fallback.
 */
export function getTenantSlug(): string {
  if (import.meta.env.DEV) {
    return env.tenantSlug.trim()
  }

  if (typeof window === 'undefined') {
    return env.tenantSlug.trim()
  }

  const host = window.location.hostname

  if (env.tenantRootDomain) {
    const fromRoot = slugFromRootDomain(host, env.tenantRootDomain)
    if (fromRoot) return fromRoot
  } else {
    const fromHeuristic = slugFromHeuristic(host)
    if (fromHeuristic) return fromHeuristic
  }

  return env.tenantSlug.trim()
}
