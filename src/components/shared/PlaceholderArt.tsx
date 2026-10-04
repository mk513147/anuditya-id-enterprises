import { createElement } from 'react'
import { getIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

const GRADIENTS = [
  'from-royal-600 via-royal-700 to-navy-900',
  'from-navy-800 via-navy-900 to-navy-950',
  'from-royal-500 via-royal-600 to-navy-800',
]

interface Props {
  icon: string
  /** Picks a gradient so neighbouring cards differ. */
  variant?: number
  className?: string
  iconClassName?: string
}

/**
 * Branded stand-in for a product photo. Decorative: pair with real text nearby.
 * Used wherever `image` is empty so swapping in real photography is a data change only.
 */
export function PlaceholderArt({ icon, variant = 0, className, iconClassName }: Props) {
  return (
    <div aria-hidden className={cn('relative grid place-items-center overflow-hidden bg-gradient-to-br', GRADIENTS[variant % GRADIENTS.length], className)}>
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-8 -left-4 size-28 rounded-full bg-gold-400/15" />
      <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
      <span className="relative grid size-14 place-items-center rounded-2xl bg-white/12 text-gold-400 ring-1 ring-white/25 backdrop-blur-sm sm:size-16">
        {createElement(getIcon(icon), { className: cn('size-7 sm:size-8', iconClassName) })}
      </span>
    </div>
  )
}
