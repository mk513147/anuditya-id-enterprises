import { motion, useReducedMotion } from 'motion/react'
import { PlaceholderArt } from '@/components/shared/PlaceholderArt'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { waMessages } from '@/lib/whatsapp'
import type { Advertisement } from '@/types'

export function AdCard({ ad, variant = 0, featured = false }: { ad: Advertisement; variant?: number; featured?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -3 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group flex h-full overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-card transition-shadow hover:shadow-card-hover',
        featured ? 'flex-col' : 'flex-col min-[480px]:flex-row lg:flex-col xl:flex-row',
      )}
    >
      <div className={cn('shrink-0 overflow-hidden', featured ? 'aspect-[16/9] lg:aspect-auto lg:min-h-64 lg:flex-1' : 'h-28 min-[480px]:h-auto min-[480px]:w-2/5 lg:h-auto lg:aspect-[16/9] lg:w-full xl:aspect-auto xl:w-2/5')}>
        {ad.image ? (
          <img src={ad.image} alt={ad.title} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <PlaceholderArt icon={ad.icon} variant={variant} className="size-full transition-transform duration-500 group-hover:scale-105" iconClassName={featured ? 'size-10' : undefined} />
        )}
      </div>
      <div className={cn('flex flex-1 flex-col', featured ? 'p-5 sm:p-6' : 'p-4')}>
        {ad.offer && (
          <Badge className="mb-2 w-fit bg-gold-100 text-gold-700 hover:bg-gold-100">{ad.offer}</Badge>
        )}
        <h3 className={cn('font-bold leading-snug', featured ? 'text-xl sm:text-2xl' : 'text-base')}>{ad.title}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-ink">{ad.description}</p>
        <WhatsAppButton size="sm" className="mt-4 h-11 w-full sm:w-fit" label="Enquire on WhatsApp" message={waMessages.ad(ad.whatsappMessage)} />
      </div>
    </motion.article>
  )
}
