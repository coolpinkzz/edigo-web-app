import logoUrl from '../../assets/logo.png'
import { cn } from '../../utils/cn'

export type BrandMarkProps = {
  /** When set, the mark is wrapped in a link (e.g. `href="/"` for the nav). */
  href?: string
  className?: string
  /** Typography for the wordmark (e.g. `text-lg` in the navbar). */
  wordmarkClassName?: string
}

export function BrandMark({
  href,
  className,
  wordmarkClassName,
}: BrandMarkProps) {
  const content = (
    <>
      <img
        src={logoUrl}
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 object-contain"
      />
      <span
        className={cn(
          'truncate font-brand bg-primary-gradient bg-clip-text font-semibold tracking-tight text-transparent',
          wordmarkClassName ?? 'text-base'
        )}
      >
        Edigo
      </span>
    </>
  )

  const rootClass = cn('flex min-w-0 items-center gap-2.5', className)

  if (href !== undefined) {
    return (
      <a href={href} className={rootClass}>
        {content}
      </a>
    )
  }

  return <div className={rootClass}>{content}</div>
}
