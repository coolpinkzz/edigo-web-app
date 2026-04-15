import { cn } from '../../utils/cn'
import type { ThemeMode } from '../../theme'

const OPTIONS: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: '☀️' },
  { mode: 'dark', label: 'Dark', icon: '🌙' },
  { mode: 'auto', label: 'Auto', icon: '🖥️' },
]

type ThemeToggleProps = {
  className?: string
  mode: ThemeMode
  onChange: (mode: ThemeMode) => void
}

export function ThemeToggle({ className, mode, onChange }: ThemeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Theme"
      className={cn(
        'inline-flex rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 shadow-sm dark:border-white/15 dark:bg-white/5',
        'transition-colors duration-300',
        className,
      )}
    >
      {OPTIONS.map(({ mode: m, label, icon }) => {
        const active = mode === m
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            title={label}
            aria-pressed={active}
            className={cn(
              'inline-flex min-w-9 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-300',
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
            )}
          >
            <span aria-hidden className="select-none">
              {icon}
            </span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
