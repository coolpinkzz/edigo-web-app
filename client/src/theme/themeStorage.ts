import type { ThemeMode } from './theme.types'

export const THEME_STORAGE_KEY = 'edigo-theme'

const VALID: ThemeMode[] = ['light', 'dark', 'auto']

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (raw && VALID.includes(raw as ThemeMode)) return raw as ThemeMode
  } catch {
    /* ignore */
  }
  return 'auto'
}

export function writeStoredThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
