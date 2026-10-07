import { CalendarClock } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { advertisementValidityLabel } from '@/lib/advertisements'
import { cn } from '@/lib/utils'
import { waMessages } from '@/lib/whatsapp'
import type { Advertisement } from '@/types'
import { AdMedia } from './AdMedia'

interface Props {
  ad: Advertisement
  variant?: number
  featured?: boolean
  /** auto: the Home page's responsive row/column cards. vertical: always image on top (listing grid). */
  layout?: 'auto' | 'vertical'
  /** When provided, a "View details" button opens the advertisement (the listing page's dialog). */
  onViewDetails?: (ad: Advertisement) => void
}

export function AdCard({ ad, variant = 0, featured = false, layout = 'auto', onViewDetails }: Props) {
  const reduce = useReducedMotion()
  const vertical = layout === 'vertical'
  const validity = advertisementValidityLabel(ad)
  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex h-full overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-card transition-shadow hover:shadow-card-hover',
        vertical || featured ? 'flex-col' : 'flex-col min-[480px]:flex-row lg:flex-col xl:flex-row',
      )}
    >
      <div
        className={cn(
          'shrink-0 overflow-hidden',
          vertical
            ? 'aspect-[16/9]'
            : featured
              ? 'aspect-[16/9] lg:aspect-auto lg:min-h-64 lg:flex-1'
              : 'h-28 min-[480px]:h-auto min-[480px]:w-2/5 lg:h-auto lg:aspect-[16/9] lg:w-full xl:aspect-auto xl:w-2/5',
        )}
      >
        <AdMedia ad={ad} variant={variant} className="size-full object-cover transition-transform duration-500 group-hover:scale-105" iconClassName={featured ? 'size-10' : undefined} />
      </div>
      <div className={cn('flex flex-1 flex-col', featured ? 'p-5 sm:p-6' : 'p-4')}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {ad.offer && <Badge className="w-fit bg-gold-100 text-gold-700 hover:bg-gold-100">{ad.offer}</Badge>}
          {vertical && ad.featured && <Badge variant="outline" className="w-fit border-royal-500/40 text-royal-700">Featured</Badge>}
        </div>
        <h3 className={cn('font-bold leading-snug', featured ? 'text-xl sm:text-2xl' : 'text-base')}>{ad.title}</h3>
        <p className={cn('mt-1.5 flex-1 text-sm leading-relaxed text-muted-ink', vertical && 'line-clamp-3')}>{ad.description}</p>
        {validity && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-ink">
            <CalendarClock className="size-3.5" aria-hidden /> {validity}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap">
          {onViewDetails && (
            <Button variant="outline" size="sm" className="h-11" onClick={() => onViewDetails(ad)} aria-label={`View details: ${ad.title}`}>
              View details
            </Button>
          )}
          <WhatsAppButton size="sm" className="h-11" label="Enquire on WhatsApp" message={waMessages.ad(ad.whatsappMessage)} />
        </div>
      </div>
    </motion.article>
  )
}
