/** User preference stored in localStorage. */
export type ThemeMode = 'light' | 'dark' | 'auto'

/** Actual appearance after resolving `auto` with local time. */
export type ResolvedTheme = 'light' | 'dark'

export type ThemeContextValue = {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
}
