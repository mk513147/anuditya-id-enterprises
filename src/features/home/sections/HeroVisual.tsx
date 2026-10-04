import { motion, useReducedMotion } from 'motion/react'
import { IdCard, User } from 'lucide-react'
import { SITE_ASSETS } from '@/data/siteAssets'
import { cn } from '@/lib/utils'

/**
 * Hero product collage.
 *
 * - If `SITE_ASSETS.heroImage` is set, that single photo is shown instead (see data/siteAssets.ts).
 * - Otherwise a CSS-drawn placeholder composition is rendered. All sizes use container-query units
 *   (cqw) so it scales cleanly from 280px to 600px wide without media queries.
 */

const cq = (n: number) => `${n}cqw`

function Float({ children, delay = 0, amp = 6, className, style }: { children: React.ReactNode; delay?: number; amp?: number; className?: string; style?: React.CSSProperties }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={cn('absolute', className)}
      style={style}
      animate={reduce ? undefined : { y: [0, -amp, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  )
}

function Book({ w, h, rotate, left, top, bg, children, z = 1 }: { w: number; h: number; rotate: number; left: number; top: number; bg: string; children: React.ReactNode; z?: number }) {
  return (
    <div
      className={cn('absolute overflow-hidden rounded-[0.6cqw] shadow-[0_1.2cqw_2.4cqw_-0.6cqw_rgb(0_0_0/0.55)]', bg)}
      style={{ width: cq(w), height: cq(h), left: cq(left), top: cq(top), transform: `rotate(${rotate}deg)`, zIndex: z }}
    >
      <div className="absolute inset-y-0 left-0 bg-black/20" style={{ width: cq(1.6) }} />
      {children}
    </div>
  )
}

function Lanyard({ left, tilt, label, name, meta, accent }: { left: number; tilt: number; label: string; name: string; meta: string; accent: string }) {
  return (
    <Float className="origin-top" delay={tilt > 0 ? 0.6 : 0} amp={4} style={{ left: cq(left), top: 0, width: cq(21), transform: `rotate(${tilt}deg)` }}>
      {/* strap */}
      <div className="mx-auto bg-gradient-to-b from-royal-500 to-royal-700" style={{ width: cq(4.2), height: cq(17) }}>
        <div className="size-full opacity-50 [background-image:repeating-linear-gradient(135deg,transparent_0_0.9cqw,rgb(255_201_51/0.7)_0.9cqw_1.3cqw)]" />
      </div>
      {/* clip */}
      <div className="mx-auto rounded-b-md bg-gradient-to-b from-slate-300 to-slate-500" style={{ width: cq(3), height: cq(2.4) }} />
      {/* card */}
      <div className="overflow-hidden rounded-[1.2cqw] bg-white shadow-[0_1.5cqw_3cqw_-0.8cqw_rgb(0_0_0/0.6)]" style={{ height: cq(30) }}>
        <div className={cn('flex items-center justify-center gap-[0.8cqw] font-display font-extrabold text-white', accent)} style={{ height: cq(5.2), fontSize: cq(1.75) }}>
          <IdCard style={{ width: cq(2.4), height: cq(2.4) }} aria-hidden />
          {label}
        </div>
        <div className="flex flex-col items-center" style={{ paddingTop: cq(2) }}>
          <div className="grid place-items-center rounded-[0.8cqw] bg-royal-100 text-royal-600 ring-1 ring-royal-500/20" style={{ width: cq(10), height: cq(11.5) }}>
            <User style={{ width: cq(6.5), height: cq(6.5) }} aria-hidden />
          </div>
          <p className="font-display font-bold text-navy-900" style={{ fontSize: cq(2.1), marginTop: cq(1.6) }}>{name}</p>
          <p className="text-muted-ink" style={{ fontSize: cq(1.6) }}>{meta}</p>
          <div className="[background-image:repeating-linear-gradient(90deg,#0a1b44_0_0.3cqw,transparent_0.3cqw_0.7cqw,#0a1b44_0.7cqw_1.1cqw,transparent_1.1cqw_1.4cqw)]" style={{ width: cq(14), height: cq(3), marginTop: cq(1.6) }} />
        </div>
      </div>
    </Float>
  )
}

export function HeroVisual({ className }: { className?: string }) {
  const reduce = useReducedMotion()

  if (SITE_ASSETS.heroImage) {
    return (
      <motion.img
        src={SITE_ASSETS.heroImage}
        alt={SITE_ASSETS.heroImageAlt}
        className={cn('mx-auto w-full max-w-xl object-contain', className)}
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.15 }}
      />
    )
  }

  return (
    <motion.div
      role="img"
      aria-label={SITE_ASSETS.heroImageAlt}
      className={cn('relative mx-auto aspect-[1.2] w-full max-w-[38rem] [container-type:inline-size]', className)}
      initial={reduce ? false : { opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
    >
      {/* soft glow */}
      <div className="absolute inset-[8%] rounded-full bg-royal-500/35 blur-3xl" />

      {/* books / printed matter */}
      <Float delay={0.3} amp={5} className="inset-0">
        <Book w={26} h={33} rotate={-6} left={45} top={40} bg="bg-gradient-to-br from-gold-500 to-gold-600" z={1}>
          <div className="relative flex size-full flex-col items-center justify-center text-navy-950" style={{ paddingLeft: cq(1.6) }}>
            <span className="font-display font-extrabold" style={{ fontSize: cq(2.6) }}>School Diary</span>
            <span className="font-semibold" style={{ fontSize: cq(2) }}>2026-27</span>
            <span className="mt-[2cqw] grid place-items-center rounded-full bg-navy-900/90 text-gold-400" style={{ width: cq(7), height: cq(7) }}>
              <IdCard style={{ width: cq(4), height: cq(4) }} aria-hidden />
            </span>
          </div>
        </Book>
        <Book w={26} h={34} rotate={3} left={56} top={12} bg="bg-gradient-to-br from-white to-royal-100" z={2}>
          <div className="relative flex size-full flex-col text-navy-900" style={{ padding: cq(2), paddingLeft: cq(3) }}>
            <span className="rounded-sm bg-royal-600 px-[1cqw] py-[0.3cqw] font-extrabold uppercase tracking-wider text-white" style={{ fontSize: cq(1.6), alignSelf: 'flex-start' }}>Magazine</span>
            <span className="mt-[1.4cqw] font-display font-extrabold leading-tight" style={{ fontSize: cq(3) }}>Education for a Better Tomorrow</span>
            <div className="mt-auto rounded-md bg-gradient-to-br from-royal-500 to-navy-800" style={{ height: cq(12) }} />
          </div>
        </Book>
        <Book w={22} h={30} rotate={9} left={76} top={30} bg="bg-gradient-to-br from-navy-700 to-navy-900" z={3}>
          <div className="relative flex size-full flex-col text-white" style={{ padding: cq(1.8), paddingLeft: cq(2.8) }}>
            <span className="font-display font-extrabold uppercase" style={{ fontSize: cq(2.4) }}>Prospectus</span>
            <span className="text-gold-400" style={{ fontSize: cq(1.5) }}>Shape your tomorrow</span>
            <div className="mt-auto rounded-t-full bg-gradient-to-t from-gold-500 to-gold-400/60" style={{ height: cq(9), width: '70%', alignSelf: 'center' }} />
          </div>
        </Book>
      </Float>

      {/* lanyards with ID cards */}
      <Lanyard left={0} tilt={-4} label="STUDENT ID CARD" name="Aarav Sharma" meta="Class 10 · Roll 23" accent="bg-royal-600" />
      <Lanyard left={22.5} tilt={3} label="STAFF ID CARD" name="Pooja Sharma" meta="Teacher" accent="bg-navy-800" />

      {/* badge */}
      <Float delay={1.2} amp={4} style={{ right: cq(0), bottom: cq(8), width: cq(21), height: cq(21) }}>
        <div className="grid size-full place-items-center rounded-full border-[0.6cqw] border-gold-400 bg-navy-950 text-center shadow-[0_1.5cqw_3cqw_-0.8cqw_rgb(0_0_0/0.6)]">
          <p className="font-display font-extrabold leading-tight text-gold-400" style={{ fontSize: cq(2.5) }}>
            PREMIUM<br />QUALITY<br />
            <span className="text-white" style={{ fontSize: cq(2) }}>LANYARD<br />&amp; RIBBON</span>
          </p>
        </div>
      </Float>

    </motion.div>
  )
}
