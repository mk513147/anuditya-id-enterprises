import { Reveal } from '@/components/shared/Reveal'
import { BENEFITS } from '@/data/homeContent'
import { getIcon } from '@/lib/icons'
import { TONE_CHIP } from '@/lib/tones'
import { cn } from '@/lib/utils'

export function BenefitsSection() {
  return (
    <section aria-label="Why customers trust us" className="container-page pt-8 sm:pt-12">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {BENEFITS.map((b, i) => {
          const Icon = getIcon(b.icon)
          return (
            <li key={b.title}>
              <Reveal delay={i * 0.05} y={14} className="h-full">
                <div className="flex h-full flex-col items-center rounded-[var(--radius-card)] border bg-white p-4 text-center shadow-card sm:p-5">
                  <span className={cn('grid size-12 place-items-center rounded-full sm:size-14', TONE_CHIP[b.tone])}>
                    <Icon className="size-6 sm:size-7" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-bold sm:text-[15px]">{b.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-ink sm:text-[13px]">{b.text}</p>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
