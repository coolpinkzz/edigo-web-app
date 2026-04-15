import type { ResolvedTheme, ThemeMode } from './theme.types'

/** 7:00–18:59 local time → light; otherwise → dark. */
export function resolvedThemeFromLocalTime(date: Date = new Date()): ResolvedTheme {
  const hour = date.getHours()
  return hour >= 7 && hour < 19 ? 'light' : 'dark'
}

export function resolveTheme(mode: ThemeMode, date: Date = new Date()): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode
  return resolvedThemeFromLocalTime(date)
}
