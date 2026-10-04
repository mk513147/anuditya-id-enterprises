import { motion, useReducedMotion } from 'motion/react'
import { CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { HERO_POINTS, HERO_TAGS } from '@/data/homeContent'
import { useQuote } from '@/features/quote/useQuote'
import { BUSINESS } from '@/lib/business'
import { waMessages } from '@/lib/whatsapp'
import { HeroVisual } from './HeroVisual'

export function HeroSection() {
  const { openQuote } = useQuote()
  const reduce = useReducedMotion()
  const item = (delay: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: 'easeOut' as const } }

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
      <div aria-hidden className="absolute -left-24 top-0 size-96 rounded-full bg-royal-600/25 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />

      <div className="container-page relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:py-20">
        <div className="min-w-0">
          <motion.p {...item(0)} className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-white/80 sm:text-sm">
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">Premium Quality</span>
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">Fast Service</span>
            <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">Trusted by Schools &amp; Colleges</span>
          </motion.p>

          <motion.p {...item(0.05)} className="font-display text-lg font-extrabold text-gold-400 sm:text-xl">
            {BUSINESS.name}
          </motion.p>
          <motion.h1 {...item(0.1)} id="hero-title" className="mt-1 text-balance text-[2rem] font-extrabold leading-[1.1] text-white min-[400px]:text-4xl sm:text-5xl xl:text-[3.4rem]">
            Premium ID Card &amp; Printing Solutions
          </motion.h1>
          <motion.p {...item(0.15)} className="mt-3 font-display text-base font-semibold text-gold-400 sm:text-lg">
            {BUSINESS.tagline}
          </motion.p>

          <motion.ul {...item(0.2)} aria-label="What we do" className="mt-5 flex max-w-xl flex-wrap gap-2">
            {HERO_TAGS.map((t) => (
              <li key={t} className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/85 sm:text-sm">
                {t}
              </li>
            ))}
          </motion.ul>

          <motion.div {...item(0.25)} className="mt-7 grid max-w-md gap-3 min-[480px]:grid-cols-2 xl:flex xl:max-w-none xl:flex-wrap">
            <Button asChild variant="gold" size="lg" className="min-[480px]:col-span-2 xl:col-auto">
              <Link to="/student-form">Submit Student Form</Link>
            </Button>
            <Button variant="outline-light" size="lg" onClick={() => openQuote()}>
              Get Quote
            </Button>
            <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.general()} />
          </motion.div>

          <motion.ul {...item(0.3)} className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
            {HERO_POINTS.map((p) => (
              <li key={p} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-gold-400" aria-hidden />
                {p}
              </li>
            ))}
          </motion.ul>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}
