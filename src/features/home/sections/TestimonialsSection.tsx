import { Link } from 'react-router-dom'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { Button } from '@/components/ui/button'
import { useApprovedFeedback } from '@/features/feedback/hooks'
import { TestimonialList } from '@/features/feedback/TestimonialList'

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
        <TestimonialList state={isError ? 'error' : isPending ? 'loading' : 'ready'} items={data} onRetry={() => void refetch()} />
      </div>
    </section>
  )
}
