import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Button } from '@/components/ui/button'
import { AdCard } from '@/features/advertisements/AdCard'
import { usePublicAdvertisements } from '@/features/advertisements/hooks'

export function AdvertisementSection() {
  const { data, isPending, isError, refetch } = usePublicAdvertisements()
  const featured = data?.find((a) => a.featured) ?? data?.[0]
  const others = data?.filter((a) => a.id !== featured?.id).slice(0, 3) ?? []

  return (
    <section aria-labelledby="ads-title" className="bg-surface">
      <div className="container-page section-y">
        <SectionHeading
          id="ads-title"
          eyebrow="Offers & Updates"
          title="Our special offers and latest updates"
          description="Sample offers shown for this prototype."
          action={
            <Button asChild variant="outline">
              <Link to="/advertisement">
                See all <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Loading offers">
            <SkeletonBlock className="h-80" />
            <SkeletonBlock className="h-80" />
          </div>
        ) : !featured ? (
          <EmptyState title="No offers right now" text="Check back soon for new offers." />
        ) : (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <Reveal className="h-full">
              <AdCard ad={featured} featured />
            </Reveal>
            <div className="grid gap-4 sm:gap-5">
              {others.map((ad, i) => (
                <Reveal key={ad.id} delay={0.06 * (i + 1)}>
                  <AdCard ad={ad} variant={i + 1} />
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
