import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Reveal } from '@/components/shared/Reveal'
import type { Feedback } from '@/types'
import { TestimonialCard } from './TestimonialCard'

export type TestimonialListState = 'loading' | 'error' | 'ready'

interface Props {
  state: TestimonialListState
  items?: Feedback[]
  onRetry?: () => void
}

/**
 * Approved testimonials with their loading, error and empty states. Shared by the Home page and the
 * Feedback page. It only renders what it is given; the repository decides what is public (approved only).
 */
export function TestimonialList({ state, items = [], onRetry }: Props) {
  if (state === 'error') return <ErrorState message="We could not load customer feedback." onRetry={onRetry} />
  if (state === 'loading') {
    return (
      <div className="grid gap-4 md:grid-cols-3" aria-busy="true" aria-label="Loading feedback">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-56" />
        ))}
      </div>
    )
  }
  if (items.length === 0) return <EmptyState title="No feedback yet" text="Be the first to share your experience." />
  return (
    <ul className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map((f, i) => (
        <li key={f.id}>
          <Reveal delay={i * 0.08} className="h-full">
            <TestimonialCard feedback={f} />
          </Reveal>
        </li>
      ))}
    </ul>
  )
}
