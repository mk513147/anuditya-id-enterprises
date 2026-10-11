import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { OrderResult, type OrderResultState } from '@/features/orders/components/OrderResult'
import { TrackOrderForm, type TrackOrderQuery } from '@/features/orders/components/TrackOrderForm'
import { useTrackOrder } from '@/features/orders/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isValidOrderReference, normalizeOrderReference } from '@/lib/orderReference'
import { waMessages } from '@/lib/whatsapp'
import { dataSource } from '@/services'
import { MOCK_DEMO_TRACKING_CODE } from '@/services/mock/orders'

/** Demo orders, shown ONLY when the site runs on demo data. Live tracking codes are never published anywhere. */
const DEMO_REFS = [
  ['JOB-2026-0007', 'Order Received'],
  ['JOB-2026-0003', 'Printing'],
  ['JOB-2026-0009', 'Dispatched'],
  ['JOB-2026-0001', 'Delivered'],
] as const

export function JobStatusPage() {
  usePageTitle('Track Your Order')
  // An old ?ref= link may prefill the order number. The tracking code is a secret and is never read from or written to
  // the URL, so the lookup itself lives in component state (a refresh clears it).
  const [params] = useSearchParams()
  const linkRef = params.get('ref') ?? ''
  const prefill = isValidOrderReference(linkRef) ? normalizeOrderReference(linkRef) : ''
  const [query, setQuery] = useState<TrackOrderQuery | null>(null)
  const [formKey, setFormKey] = useState(0)
  const lookup = useTrackOrder()

  const submit = (q: TrackOrderQuery) => {
    setQuery(q)
    lookup.mutate(q)
  }
  const trackAnother = () => {
    setQuery(null)
    lookup.reset()
    setFormKey((k) => k + 1) // a fresh, empty form (the code is not kept)
  }

  let state: OrderResultState | null = null
  if (query) {
    if (lookup.isPending) state = { kind: 'loading' }
    else if (lookup.isError) state = { kind: 'error', reference: query.orderNo }
    else if (lookup.data === null) state = { kind: 'not-found', reference: query.orderNo }
    else if (lookup.data) state = { kind: 'found', order: lookup.data }
  }

  return (
    <>
      <PageHero
        breadcrumb="Job Status"
        eyebrow="Job Status"
        title="Track Your Order"
        description="Enter your order number and the tracking code from your order confirmation to see where your ID cards or printing order is right now."
      />

      <div className="container-page py-8 sm:py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <TrackOrderForm key={formKey} initialValue={formKey === 0 ? prefill : ''} busy={lookup.isPending} autoFocus={formKey > 0} onSubmit={submit} />

          {!query && dataSource === 'mock' && (
            <section aria-labelledby="demo-refs" className="rounded-[var(--radius-card)] bg-royal-50 p-4 sm:p-5">
              <h2 id="demo-refs" className="font-display text-base font-bold text-navy-900">
                Try a demo order
              </h2>
              <p className="mt-1 text-sm text-muted-ink">
                This site is running on demo data. Every sample order uses the tracking code <span className="font-mono font-semibold text-ink">{MOCK_DEMO_TRACKING_CODE}</span>.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {DEMO_REFS.map(([ref, label]) => (
                  <li key={ref}>
                    <button
                      type="button"
                      onClick={() => submit({ orderNo: ref, trackingCode: MOCK_DEMO_TRACKING_CODE })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-navy-900 transition-colors hover:border-royal-500 hover:bg-royal-100"
                    >
                      <span className="font-mono">{ref}</span>
                      <span className="text-xs font-medium text-muted-ink">{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state && <OrderResult state={state} onRetry={() => query && lookup.mutate(query)} onTrackAnother={trackAnother} />}
        </div>
      </div>

      <CtaBanner
        title="Need help with your order?"
        text="Call or message us and we will check it for you."
        message={waMessages.general()}
        showQuote={false}
        showCall
      />
    </>
  )
}
