import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { waMessages } from '@/lib/whatsapp'
import type { Advertisement } from '@/types'
import { AdCard } from './AdCard'

export type AdvertisementListingState = 'loading' | 'error' | 'ready'

interface Props {
  state: AdvertisementListingState
  ads?: Advertisement[]
  onRetry?: () => void
  onView?: (ad: Advertisement) => void
}

const GRID = 'grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3'

/** Presentational: loading, error, empty and list are explicit inputs, so each is testable on its own. */
export function AdvertisementListing({ state, ads = [], onRetry, onView }: Props) {
  if (state === 'loading') {
    return (
      <div className={GRID} aria-busy="true" aria-label="Loading offers">
        {[0, 1, 2].map((i) => (
          <SkeletonBlock key={i} className="h-80" />
        ))}
      </div>
    )
  }
  if (state === 'error') return <ErrorState message="We could not load the offers." onRetry={onRetry} />
  if (ads.length === 0) {
    return (
      <EmptyState
        title="No offers available right now"
        text="New offers appear here as soon as they are published. Message us to ask about current pricing."
        action={<WhatsAppButton label="WhatsApp Us" message={waMessages.general()} />}
      />
    )
  }
  return (
    <ul className={GRID}>
      {ads.map((ad, i) => (
        <li key={ad.id}>
          <AdCard ad={ad} variant={i} layout="vertical" onViewDetails={onView} />
        </li>
      ))}
    </ul>
  )
}
