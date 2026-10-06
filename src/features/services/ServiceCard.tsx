import { motion, useReducedMotion } from 'motion/react'
import { createElement } from 'react'
import { PlaceholderArt } from '@/components/shared/PlaceholderArt'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { useQuote } from '@/features/quote/useQuote'
import { getIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { waMessages } from '@/lib/whatsapp'
import type { Service } from '@/types'

interface Props {
  service: Service
  index?: number
  /**
   * compact: dense grid card (homepage), icon-only WhatsApp, clamped description.
   * detailed: roomier card (services page), labelled WhatsApp, full description.
   */
  variant?: 'compact' | 'detailed'
}

export function ServiceCard({ service, index = 0, variant = 'compact' }: Props) {
  const { openQuote } = useQuote()
  const reduce = useReducedMotion()
  const detailed = variant === 'detailed'

  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -4 }}
      transition={{ duration: 0.2 }}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-card transition-shadow focus-within:shadow-card-hover hover:shadow-card-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {service.image ? (
          <img
            src={service.image}
            alt={service.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <PlaceholderArt icon={service.icon} variant={index} className="size-full transition-transform duration-500 group-hover:scale-105" />
        )}
        {/* With a real photo the placeholder icon is gone, so keep a small icon chip for recognition. */}
        {service.image && (
          <span aria-hidden className="absolute bottom-3 left-3 grid size-9 place-items-center rounded-xl bg-navy-900/85 text-gold-400 ring-1 ring-white/20 backdrop-blur-sm">
            {createElement(getIcon(service.icon), { className: 'size-5' })}
          </span>
        )}
      </div>
      <div className={cn('flex flex-1 flex-col', detailed ? 'p-4 sm:p-5' : 'p-3 sm:p-4')}>
        <h3 className={cn('font-bold leading-snug text-balance', detailed ? 'text-lg' : 'text-[15px] sm:text-base')}>{service.title}</h3>
        <p className="mt-0.5 text-xs font-medium text-royal-600">{service.tagline}</p>
        <p className={cn('mt-2 flex-1 leading-relaxed text-muted-ink', detailed ? 'text-sm' : 'line-clamp-3 text-[13px] sm:text-sm')}>
          {service.description}
        </p>
        <div className={cn('flex items-center gap-2', detailed ? 'mt-4' : 'mt-3')}>
          <Button size="sm" className="h-11 min-w-0 flex-1 px-2 sm:px-3" onClick={() => openQuote(service.title)}>
            Get Quote
          </Button>
          {detailed ? (
            <WhatsAppButton
              size="sm"
              className="h-11 flex-1"
              label="WhatsApp"
              aria-label={`Enquire about ${service.title} on WhatsApp`}
              message={waMessages.quote(service.title)}
            />
          ) : (
            <WhatsAppButton
              size="icon"
              iconOnly
              className="size-11 shrink-0"
              label={`WhatsApp about ${service.title}`}
              message={waMessages.quote(service.title)}
            />
          )}
        </div>
      </div>
    </motion.article>
  )
}
