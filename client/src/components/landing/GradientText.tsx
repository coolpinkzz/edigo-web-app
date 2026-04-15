import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

/** Keyword emphasis using `bg-primary-gradient` with clipped text (see `index.css`). */
export function GradientText({ children, className = '' }: Props) {
  return (
    <span
      className={`bg-primary-gradient bg-clip-text font-semibold text-transparent ${className}`.trim()}
    >
      {children}
    </span>
  )
}
