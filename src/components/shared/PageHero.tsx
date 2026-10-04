import { motion, useReducedMotion } from 'motion/react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  description?: string
  eyebrow?: string
  /** Current page label shown in the breadcrumb after "Home". */
  breadcrumb?: string
  children?: ReactNode
}

/** Compact navy hero shared by inner pages. */
export function PageHero({ title, description, eyebrow, breadcrumb, children }: Props) {
  const reduce = useReducedMotion()
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white">
      <div aria-hidden className="absolute -right-20 -top-24 size-80 rounded-full bg-royal-600/30 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 left-1/4 size-64 rounded-full bg-gold-400/10 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
      <motion.div
        className="container-page relative py-10 sm:py-14 lg:py-16"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex items-center gap-1.5 text-sm text-white/70">
              <li>
                <Link to="/" className="-my-3 inline-flex min-h-11 items-center rounded transition-colors hover:text-gold-400">Home</Link>
              </li>
              <ChevronRight className="size-4" aria-hidden />
              <li aria-current="page" className="font-medium text-white">{breadcrumb}</li>
            </ol>
          </nav>
        )}
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gold-400">{eyebrow}</p>}
        <h1 className="text-balance text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-white/80 sm:text-lg">{description}</p>}
        {children && <div className="mt-6">{children}</div>}
      </motion.div>
    </section>
  )
}
