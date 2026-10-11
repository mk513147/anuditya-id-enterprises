import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Order } from '@/types'

/**
 * Order placed (from the order date) followed by every status change an admin has recorded.
 * Seeded demo orders carry no earlier history, so none is invented for them.
 */
export function OrderHistory({ order }: { order: Pick<Order, 'orderDate' | 'statusHistory'> }) {
  const changes = order.statusHistory ?? []
  return (
    <div>
      <ol aria-label="Status history" className="divide-y rounded-xl border">
        <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <span className="font-medium text-ink">Order placed</span>
          <span className="text-muted-ink">{formatDate(order.orderDate)}</span>
        </li>
        {changes.map((c, i) => (
          <li key={`${c.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm" data-testid="history-entry">
            <span className="flex items-center gap-2">
              <span className="text-muted-ink">Changed to</span> <OrderStatusBadge status={c.status} />
            </span>
            <time dateTime={c.at} className="text-muted-ink">{formatDateTime(c.at)}</time>
          </li>
        ))}
      </ol>
      {changes.length === 0 && (
        <p className="mt-3 text-sm text-muted-ink">No status changes have been recorded yet. Changes made from this page appear here (prototype data resets when the page is reloaded).</p>
      )}
    </div>
  )
}
