import { Eye } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Column } from '@/components/admin/DataTable'
import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { AdminOrder } from '@/services/types'

export const adminOrderColumns: Column<AdminOrder>[] = [
  {
    key: 'order',
    header: 'Order',
    cell: (o) => (
      <span>
        <Link to={`/admin/orders/${o.id}`} className="-my-3 inline-flex min-h-11 items-center rounded font-mono text-[13px] font-semibold text-navy-900 hover:text-royal-600 hover:underline">
          {o.orderNo}
        </Link>
        <span className="block text-xs font-normal text-muted-ink">{o.service}</span>
      </span>
    ),
  },
  { key: 'school', header: 'School', cell: (o) => o.schoolName },
  { key: 'qty', header: 'Qty', cell: (o) => o.quantity.toLocaleString('en-IN') },
  { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
  { key: 'date', header: 'Ordered', cell: (o) => formatDate(o.orderDate), className: 'whitespace-nowrap' },
  { key: 'due', header: 'Expected', cell: (o) => formatDate(o.expectedDelivery), className: 'whitespace-nowrap' },
]

/** Row action: open the order. Icon-only in the table, labelled on phone cards. */
export function orderRowActions(o: AdminOrder, context: 'table' | 'card') {
  if (context === 'table') {
    return (
      <Button asChild variant="ghost" size="icon" className="size-9" title="View order">
        <Link to={`/admin/orders/${o.id}`} aria-label={`View order ${o.orderNo}`}>
          <Eye />
        </Link>
      </Button>
    )
  }
  return (
    <Button asChild variant="outline" className="h-11 w-full">
      <Link to={`/admin/orders/${o.id}`} aria-label={`View order ${o.orderNo}`}>
        <Eye /> View order
      </Link>
    </Button>
  )
}
