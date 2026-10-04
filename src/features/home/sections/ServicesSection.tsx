import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Button } from '@/components/ui/button'
import { ServiceCard } from '@/features/services/ServiceCard'
import { usePublicServices } from '@/features/services/hooks'

export function ServicesSection() {
  const { data, isPending, isError, refetch } = usePublicServices()

  return (
    <section aria-labelledby="services-title" className="bg-surface">
      <div className="container-page section-y">
        <SectionHeading
          id="services-title"
          eyebrow="Our Services"
          title="Complete ID card and printing solutions"
          description="Everything your school, college or organisation needs, from one trusted partner."
          action={
            <Button asChild variant="outline">
              <Link to="/services">
                View All Services <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading services">
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonBlock key={i} className="h-64" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState title="No services available" text="Please check back soon." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {data.map((s, i) => (
              <li key={s.id}>
                <Reveal delay={(i % 4) * 0.05} y={16} className="h-full">
                  <ServiceCard service={s} index={i} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
