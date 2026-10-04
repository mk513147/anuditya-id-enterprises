import { motion, useReducedMotion } from 'motion/react'
import { useSearchParams } from 'react-router-dom'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Reveal } from '@/components/shared/Reveal'
import { SERVICE_CATEGORIES, isServiceCategory } from '@/data/serviceCategories'
import { usePublicServices } from '@/features/services/hooks'
import { ServiceCard } from '@/features/services/ServiceCard'
import { usePageTitle } from '@/hooks/usePageTitle'
import { BUSINESS } from '@/lib/business'
import { cn } from '@/lib/utils'
import { waMessages } from '@/lib/whatsapp'

const GRID = 'grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4'

export function ServicesPage() {
  usePageTitle('Our Services')
  const reduce = useReducedMotion()
  const { data, isPending, isError, refetch } = usePublicServices()
  const [params, setParams] = useSearchParams()
  const raw = params.get('category')
  const active = isServiceCategory(raw) ? raw : 'all'

  const setActive = (id: string) =>
    setParams(id === 'all' ? {} : { category: id }, { replace: true, preventScrollReset: true })

  const filters = [
    { id: 'all', label: 'All', count: data?.length },
    ...SERVICE_CATEGORIES.map((c) => ({ ...c, count: data?.filter((s) => s.category === c.id).length })),
  ]
  const visible = data?.filter((s) => active === 'all' || s.category === active) ?? []

  return (
    <>
      <PageHero
        breadcrumb="Services"
        eyebrow={BUSINESS.tagline}
        title="Our Services"
        description={`${BUSINESS.name} provides ID card, printing and designing solutions for schools, colleges and organisations.`}
      />

      <section aria-label="Services" className="container-page py-10 sm:py-14">
        <Reveal>
          <div role="group" aria-label="Filter services by category" className="mb-6 flex flex-wrap gap-2 sm:mb-8">
            {filters.map((f) => {
              const on = f.id === active
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setActive(f.id)}
                  className={cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
                    on ? 'border-royal-600 bg-royal-600 text-white shadow-sm' : 'border-border bg-white text-navy-900 hover:border-royal-500 hover:bg-royal-50',
                  )}
                >
                  {f.label}
                  {f.count !== undefined && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', on ? 'bg-white/20 text-white' : 'bg-royal-100 text-royal-700')}>{f.count}</span>
                  )}
                </button>
              )
            })}
          </div>
        </Reveal>

        <p aria-live="polite" className="sr-only">
          {data ? `Showing ${visible.length} services` : ''}
        </p>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <div className={GRID} aria-busy="true" aria-label="Loading services">
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonBlock key={i} className="h-[26rem]" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState title="No services in this category" text="Try another category." />
        ) : (
          <motion.ul
            key={active}
            className={GRID}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {visible.map((s, i) => (
              <li key={s.id}>
                <Reveal delay={(i % 4) * 0.05} y={16} className="h-full">
                  <ServiceCard service={s} index={i} variant="detailed" />
                </Reveal>
              </li>
            ))}
          </motion.ul>
        )}
      </section>

      <CtaBanner
        title="Need a Custom Printing Solution?"
        text="Tell us what you need and we'll help you find the right solution."
        message={waMessages.general()}
      />
    </>
  )
}
