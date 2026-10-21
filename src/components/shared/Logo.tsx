import { Link } from 'react-router-dom'
import { LOGO_ASSETS, LOGO_NAME } from '@/lib/logo'
import { cn } from '@/lib/utils'

/**
 * full: symbol, wordmark and tagline (where there is room for the tagline to be read).
 * compact: symbol and wordmark (narrow headers, sidebars, menus).
 * symbol: the red "A" only (tiny spaces).
 * responsive: compact below the `xl` breakpoint, full from `xl` up (the main site header).
 */
export type LogoVariant = keyof typeof LOGO_ASSETS | 'responsive'

interface LogoProps {
  variant?: LogoVariant
  /** Size the image with a height class (e.g. "h-10"); the width follows from the aspect ratio. */
  className?: string
  /**
   * Text alternative. Defaults to the logo's name. Ignored when the logo is a link: the link carries the name instead,
   * so screen readers do not hear it twice.
   */
  alt?: string
  /** Wraps the logo in a link (default: the home page). `null` renders the image only. */
  to?: string | null
  /** Link label (only with `to`). */
  linkLabel?: string
  /**
   * Places the logo on a white plate. Use it on dark surfaces: the charcoal "ID Solutions" is not legible on navy, and the
   * official colours are never changed to compensate.
   */
  plate?: boolean
}

const DEFAULT_HEIGHT: Record<LogoVariant, string> = {
  full: 'h-12',
  compact: 'h-9',
  symbol: 'h-8',
  responsive: 'h-9 xl:h-[52px]',
}

function LogoImage({ variant, className, alt }: { variant: LogoVariant; className?: string; alt: string }) {
  const cls = cn('block w-auto max-w-full select-none', DEFAULT_HEIGHT[variant], className)
  if (variant === 'responsive') {
    const { full, compact } = LOGO_ASSETS
    return (
      <picture className="contents">
        <source media="(min-width: 1280px)" srcSet={full.src} width={full.width} height={full.height} />
        <img src={compact.src} width={compact.width} height={compact.height} alt={alt} className={cls} draggable={false} decoding="async" />
      </picture>
    )
  }
  const a = LOGO_ASSETS[variant]
  return <img src={a.src} width={a.width} height={a.height} alt={alt} className={cls} draggable={false} decoding="async" />
}

/** The one place the brand logo is rendered. */
export function Logo({ variant = 'compact', className, alt = LOGO_NAME, to = '/', linkLabel = `${LOGO_NAME} – home`, plate = false }: LogoProps) {
  const wrap = cn('inline-flex shrink-0 items-center', plate && 'rounded-xl bg-white px-3 py-2 shadow-sm')
  // Inside a labelled link the image is decorative (alt=""), so the name is announced once.
  const image = <LogoImage variant={variant} className={className} alt={to === null ? alt : ''} />
  if (to === null) return <span className={wrap}>{image}</span>
  return (
    <Link to={to} aria-label={linkLabel} className={cn(wrap, 'rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50')}>
      {image}
    </Link>
  )
}
