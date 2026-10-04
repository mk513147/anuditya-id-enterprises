import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { QUICK_ACTIONS } from '@/data/homeContent'
import { useQuote } from '@/features/quote/useQuote'
import { getIcon } from '@/lib/icons'
import { TONE_SOLID } from '@/lib/tones'
import { cn } from '@/lib/utils'

export function QuickActionsSection() {
  const { openQuote } = useQuote()
  return (
    <section aria-labelledby="quick-title" className="container-page section-y">
      <SectionHeading id="quick-title" eyebrow="Get started" title="What would you like to do?" description="Pick an action below. Each one takes just a minute." />
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {QUICK_ACTIONS.map((a, i) => {
          const Icon = getIcon(a.icon)
          const cls = cn(
            'group flex min-h-[84px] w-full items-center gap-4 rounded-[var(--radius-card)] bg-gradient-to-br p-4 text-left text-white shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover sm:p-5 lg:min-h-[168px] lg:flex-col lg:items-start lg:justify-between',
            TONE_SOLID[a.tone],
          )
          const body = (
            <>
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30 lg:size-14">
                <Icon className="size-6 lg:size-7" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-extrabold leading-tight">{a.title}</span>
                <span className="mt-0.5 block text-sm text-white/85">{a.text}</span>
              </span>
              <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-1 lg:self-end" aria-hidden />
            </>
          )
          return (
            <li key={a.title}>
              <Reveal delay={i * 0.06} y={14} className="h-full">
                {a.to ? (
                  <Link to={a.to} className={cls}>{body}</Link>
                ) : (
                  <button type="button" onClick={() => openQuote()} className={cls}>{body}</button>
                )}
              </Reveal>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
