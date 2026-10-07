import { useState } from 'react'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { Reveal } from '@/components/shared/Reveal'
import { AdDetailDialog } from '@/features/advertisements/AdDetail'
import { AdvertisementListing } from '@/features/advertisements/AdvertisementListing'
import { usePublicAdvertisements } from '@/features/advertisements/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { waMessages } from '@/lib/whatsapp'
import type { Advertisement } from '@/types'

export function AdvertisementPage() {
  usePageTitle('Offers & Advertisements')
  // Same hook and repository as the Home page section, so both always show the same offers.
  const { data, isPending, isError, refetch } = usePublicAdvertisements()
  const [selected, setSelected] = useState<Advertisement | null>(null)

  return (
    <>
      <PageHero
        breadcrumb="Advertisement"
        eyebrow="Offers & Updates"
        title="Our Offers & Updates"
        description="Current offers and updates from Anuditya ID Enterprises for schools, colleges and organisations."
      />

      <section aria-label="Offers" className="container-page py-10 sm:py-14">
        <Reveal>
          <p className="mb-6 max-w-2xl text-sm text-muted-ink sm:mb-8">
            Sample offers are shown for this prototype. Message us on WhatsApp to confirm what is available for your institution.
          </p>
        </Reveal>
        <AdvertisementListing
          state={isError ? 'error' : isPending ? 'loading' : 'ready'}
          ads={data}
          onRetry={() => void refetch()}
          onView={setSelected}
        />
      </section>

      <AdDetailDialog ad={selected} onClose={() => setSelected(null)} />

      <CtaBanner
        title="Looking for something specific?"
        text="Tell us what you need and we will share the right offer."
        message={waMessages.general()}
      />
    </>
  )
}
