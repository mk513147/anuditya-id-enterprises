import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { PROCESS_STEPS } from '@/data/homeContent'
import { getIcon } from '@/lib/icons'

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-title" className="container-page section-y">
      <SectionHeading id="how-title" eyebrow="How It Works" title="From your details to delivery in five steps" description="A clear process, so you always know what happens next." />

      <ol className="relative mx-auto max-w-md lg:grid lg:max-w-none lg:grid-cols-5 lg:gap-4">
        {/* desktop connector line */}
        <div aria-hidden className="absolute left-[10%] right-[10%] top-8 hidden h-0.5 bg-gradient-to-r from-royal-100 via-royal-500 to-royal-100 lg:block" />
        {PROCESS_STEPS.map((s, i) => {
          const Icon = getIcon(s.icon)
          return (
            <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0 lg:flex-col lg:items-center lg:pb-0 lg:text-center">
              {/* mobile connector line */}
              {i < PROCESS_STEPS.length - 1 && <div aria-hidden className="absolute left-8 top-16 h-[calc(100%-4rem)] w-0.5 bg-royal-100 lg:hidden" />}
              <Reveal delay={i * 0.08} y={14} className="flex gap-4 lg:flex-col lg:items-center">
                <div className="relative z-10 grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-royal-600 to-navy-900 text-white shadow-card ring-4 ring-white">
                  <Icon className="size-7" aria-hidden />
                  <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-gold-500 font-display text-xs font-extrabold text-navy-950 ring-2 ring-white">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="min-w-0 pt-1 lg:pt-3">
                  <h3 className="text-base font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-ink">{s.text}</p>
                </div>
              </Reveal>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
