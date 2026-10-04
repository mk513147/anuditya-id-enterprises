import { IdCard } from 'lucide-react'
import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { WHY_POINTS } from '@/data/homeContent'
import { BUSINESS } from '@/lib/business'
import { getIcon } from '@/lib/icons'

export function WhyChooseUsSection() {
  return (
    <section aria-labelledby="why-title" className="container-page section-y">
      <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <Reveal>
          <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-navy-900 via-navy-800 to-royal-700 p-7 text-white shadow-card sm:p-10">
            <div aria-hidden className="absolute -right-10 -top-10 size-44 rounded-full bg-gold-400/20 blur-2xl" />
            <span className="relative grid size-14 place-items-center rounded-2xl bg-white/10 text-gold-400 ring-1 ring-white/25">
              <IdCard className="size-7" aria-hidden />
            </span>
            <h2 className="relative mt-5 text-balance text-2xl font-extrabold text-white sm:text-3xl">Why choose {BUSINESS.name}?</h2>
            <p className="relative mt-3 text-white/80">
              A local ID card and printing partner that understands what schools and colleges actually need: accurate data, clean design and dependable delivery.
            </p>
            <p className="relative mt-5 font-display font-bold text-gold-400">{BUSINESS.tagline}</p>
          </div>
        </Reveal>

        <div>
          <SectionHeading id="why-title" align="left" eyebrow="Why Choose Us" title="Quality you can see, service you can rely on" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {WHY_POINTS.map((p, i) => {
              const Icon = getIcon(p.icon)
              return (
                <li key={p.title}>
                  <Reveal delay={i * 0.05} y={14} className="h-full">
                    <div className="flex h-full gap-3 rounded-2xl border bg-white p-4 shadow-card">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-royal-50 text-royal-600">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <h3 className="text-[15px] font-bold">{p.title}</h3>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-ink">{p.text}</p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
