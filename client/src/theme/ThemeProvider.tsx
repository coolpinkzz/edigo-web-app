import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ResolvedTheme, ThemeMode } from './theme.types'
import { ThemeContext } from './theme-context'
import { resolveTheme } from './themeFromTime'
import { readStoredThemeMode, writeStoredThemeMode } from './themeStorage'

function applyHtmlClass(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredThemeMode())
  /** Bumps on a timer while mode is `auto` so resolved theme follows local time. */
  const [autoTick, setAutoTick] = useState(0)

  const resolvedTheme = useMemo(() => {
    void autoTick
    return resolveTheme(mode)
  }, [mode, autoTick])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    writeStoredThemeMode(next)
  }, [])

  useLayoutEffect(() => {
    applyHtmlClass(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (mode !== 'auto') return

    const bump = () => setAutoTick((n) => n + 1)
    const id = window.setInterval(bump, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') bump()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [mode])

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      setMode,
    }),
    [mode, resolvedTheme, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
