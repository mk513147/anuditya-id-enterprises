import { AlertTriangle, PackageSearch, RotateCcw, SearchX } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { SkeletonBlock } from '@/components/shared/QueryState'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { waMessages } from '@/lib/whatsapp'
import type { PublicOrder } from '@/types'
import { STATUS_MESSAGE } from '../timeline'
import { OrderTimeline } from './OrderTimeline'

export type OrderResultState =
  | { kind: 'loading' }
  | { kind: 'found'; order: PublicOrder }
  | { kind: 'not-found'; reference: string }
  | { kind: 'error'; reference: string }

interface Props {
  state: OrderResultState
  onRetry?: () => void
  onTrackAnother?: () => void
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius-card)] border bg-white shadow-card ${className}`}>{children}</section>
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-ink">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-navy-900">{children}</dd>
    </div>
  )
}

/**
 * Presentational: every state of the lookup is an explicit input, so each can be rendered and tested
 * without a network or a router. Focus moves to the heading when a result (or problem) appears.
 */
export function OrderResult({ state, onRetry, onTrackAnother }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const kind = state.kind
  useEffect(() => {
    if (kind !== 'loading') headingRef.current?.focus()
  }, [kind])

  if (state.kind === 'loading') {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
        <p className="sr-only">Looking up your order…</p>
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-56" />
      </div>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <Panel className="p-6 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold-100 text-gold-700">
          <SearchX className="size-7" aria-hidden />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="mt-4 text-xl font-bold outline-none">
          We could not find that order
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-ink">
          There is no order with the reference <strong className="break-all text-ink">“{state.reference}”</strong>. Please check the number on your receipt or message, and try again.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 min-[420px]:flex-row">
          <Button size="lg" onClick={onTrackAnother}>
            <RotateCcw aria-hidden /> Try another number
          </Button>
          <WhatsAppButton size="lg" label="Ask us on WhatsApp" message={waMessages.general()} />
        </div>
      </Panel>
    )
  }

  if (state.kind === 'error') {
    return (
      <div role="alert" className="rounded-[var(--radius-card)] border border-destructive/30 bg-red-50 p-6 text-center sm:p-8">
        <AlertTriangle className="mx-auto size-8 text-destructive" aria-hidden />
        <h2 ref={headingRef} tabIndex={-1} className="mt-3 text-lg font-bold text-destructive outline-none">
          Something went wrong while checking your order
        </h2>
        <p className="mt-1 text-sm text-ink">This is a problem on our side, not a wrong number. Please try again, or contact us.</p>
        <div className="mt-5 flex flex-col justify-center gap-3 min-[420px]:flex-row">
          <Button size="lg" variant="destructive" onClick={onRetry}>
            Try Again
          </Button>
          <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.order(state.reference)} />
        </div>
      </div>
    )
  }

  const { order } = state
  const delivered = order.status === 'Delivered'
  return (
    <div className="space-y-5" aria-live="polite">
      <Panel>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-ink">
              <PackageSearch className="size-4" aria-hidden /> Order reference
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="mt-1 break-all font-mono text-2xl font-extrabold text-navy-900 outline-none" data-testid="order-ref">
              {order.orderNo}
            </h2>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-muted-ink">Current status</p>
            <div className="mt-1" data-testid="order-status">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
        </div>
        <p className="border-b bg-royal-50 px-4 py-3 text-sm font-medium text-royal-700 sm:px-6">{STATUS_MESSAGE[order.status]}</p>
        <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <Fact label="School / customer">{order.customer}</Fact>
          <Fact label="Order">{order.service}</Fact>
          <Fact label="Quantity">{order.quantity.toLocaleString('en-IN')}</Fact>
          <Fact label="Order date">{formatDate(order.orderDate)}</Fact>
          {!delivered && <Fact label="Expected delivery">{formatDate(order.expectedDelivery)}</Fact>}
        </dl>
      </Panel>

      <Panel className="p-4 sm:p-6">
        <h3 className="mb-5 text-lg font-bold">Progress</h3>
        <OrderTimeline status={order.status} />
      </Panel>

      <div className="flex flex-col gap-3 min-[420px]:flex-row">
        <WhatsAppButton size="lg" label="Ask about this order" message={waMessages.order(order.orderNo)} />
        <Button size="lg" variant="outline" onClick={onTrackAnother}>
          <RotateCcw aria-hidden /> Track another order
        </Button>
      </div>
    </div>
  )
}
