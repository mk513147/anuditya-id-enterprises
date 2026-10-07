import { useSearchParams } from 'react-router-dom'
import { CtaBanner } from '@/components/shared/CtaBanner'
import { PageHero } from '@/components/shared/PageHero'
import { OrderResult, type OrderResultState } from '@/features/orders/components/OrderResult'
import { TrackOrderForm } from '@/features/orders/components/TrackOrderForm'
import { useTrackOrder } from '@/features/orders/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { normalizeOrderReference } from '@/lib/orderReference'
import { waMessages } from '@/lib/whatsapp'
import { trackOrderSchema } from '@/validations/jobStatus'
import { useState } from 'react'
import { Link } from 'react-router-dom'

/** Demo references so the prototype can be explored. Real references come from receipts / messages. */
const DEMO_REFS = [
  ['JOB-2026-0007', 'Order Received'],
  ['JOB-2026-0003', 'Printing'],
  ['JOB-2026-0009', 'Dispatched'],
  ['JOB-2026-0001', 'Delivered'],
] as const

export function JobStatusPage() {
  usePageTitle('Track Your Order')
  // The reference lives in the URL (?ref=…), so a result can be bookmarked or shared and "Back" works.
  const [params, setParams] = useSearchParams()
  const raw = params.get('ref') ?? ''
  const parsed = raw ? trackOrderSchema.safeParse({ reference: raw }) : null
  const reference = parsed?.success ? normalizeOrderReference(parsed.data.reference) : null
  const invalidMessage = parsed && !parsed.success ? parsed.error.issues[0]?.message : undefined
  const [focusForm, setFocusForm] = useState(false)

  const lookup = useTrackOrder(reference)
  const busy = lookup.isFetching

  const submit = (ref: string) => {
    if (ref === reference) void lookup.refetch() // same number again: check for a newer status
    else setParams({ ref })
  }
  const trackAnother = () => {
    setFocusForm(true)
    setParams({})
  }

  let state: OrderResultState | null = null
  if (reference) {
    if (lookup.isFetching) state = { kind: 'loading' }
    else if (lookup.isError) state = { kind: 'error', reference }
    else if (lookup.data === null) state = { kind: 'not-found', reference }
    else if (lookup.data) state = { kind: 'found', order: lookup.data }
  }

  return (
    <>
      <PageHero
        breadcrumb="Job Status"
        eyebrow="Job Status"
        title="Track Your Order"
        description="Enter your job or order number to see where your ID cards or printing order is right now."
      />

      <div className="container-page py-8 sm:py-12">
        <div className="mx-auto max-w-4xl space-y-6">
          <TrackOrderForm
            key={raw}
            initialValue={raw}
            initialError={invalidMessage}
            busy={busy}
            autoFocus={focusForm}
            onSubmit={submit}
          />

          {!reference && (
            <section aria-labelledby="demo-refs" className="rounded-[var(--radius-card)] bg-royal-50 p-4 sm:p-5">
              <h2 id="demo-refs" className="font-display text-base font-bold text-navy-900">
                Try a demo reference
              </h2>
              <p className="mt-1 text-sm text-muted-ink">This is a prototype, so these sample orders are provided for you to explore.</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {DEMO_REFS.map(([ref, label]) => (
                  <li key={ref}>
                    <Link
                      to={`/job-status?ref=${ref}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-navy-900 transition-colors hover:border-royal-500 hover:bg-royal-100"
                    >
                      <span className="font-mono">{ref}</span>
                      <span className="text-xs font-medium text-muted-ink">{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state && <OrderResult state={state} onRetry={() => void lookup.refetch()} onTrackAnother={trackAnother} />}
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
