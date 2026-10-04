import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Reveal } from '@/components/shared/Reveal'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Button } from '@/components/ui/button'
import { useApprovedFeedback } from '@/features/feedback/hooks'
import { TestimonialCard } from '@/features/feedback/TestimonialCard'

export function TestimonialsSection() {
  const { data, isPending, isError, refetch } = useApprovedFeedback()

  return (
    <section aria-labelledby="testi-title" className="bg-surface">
      <div className="container-page section-y">
        <SectionHeading
          id="testi-title"
          eyebrow="Customer Feedback"
          title="What schools and colleges say"
          description="Sample feedback shown for this prototype."
          action={
            <Button asChild variant="outline">
              <Link to="/feedback">Share your feedback</Link>
            </Button>
          }
        />
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading feedback">
            {[0, 1, 2].map((i) => (
              <SkeletonBlock key={i} className="h-56" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState title="No feedback yet" text="Be the first to share your experience." />
        ) : (
          <ul className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.map((f, i) => (
              <li key={f.id}>
                <Reveal delay={i * 0.08} className="h-full">
                  <TestimonialCard feedback={f} />
                </Reveal>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
