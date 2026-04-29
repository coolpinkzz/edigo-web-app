import { forwardRef } from 'react'
import type { InputHTMLAttributes, KeyboardEvent } from 'react'
import { cn } from '../../utils/cn'

const hideNumberSpinnerClass =
  '[-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

const NUMBER_STEP_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
])

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
  label?: string
  /** Hides spinners and blocks keys that step the value (arrows, page up/down, home/end) */
  hideNumberSpinners?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      error,
      hideNumberSpinners,
      label,
      id,
      onKeyDown,
      type,
      ...props
    },
    ref,
  ) => {
    const inputId = id ?? props.name

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (
        hideNumberSpinners &&
        type === 'number' &&
        NUMBER_STEP_KEYS.has(e.key)
      ) {
        e.preventDefault()
      }
      onKeyDown?.(e)
    }

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-foreground/80"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'block w-full rounded-lg border border-card-border px-3 py-2 text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:bg-muted',
            error && 'border-red-400 focus:border-red-500 focus:ring-red-500/30',
            hideNumberSpinners && hideNumberSpinnerClass,
            className,
          )}
          aria-invalid={error ? true : undefined}
          type={type}
          onKeyDown={handleKeyDown}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
