import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminCard } from '@/components/admin/AdminPageHeader'
import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { formatDate, formatDateTime } from '@/lib/format'
import type { AdminOrder } from '@/services/types'
import { OrderTimeline } from '../components/OrderTimeline'
import { STATUS_MESSAGE } from '../timeline'
import { OrderHistory } from './OrderHistory'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-ink">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-navy-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/**
 * Presentational detail for one order. `updater` is the slot for the status-change control, so this view
 * renders (and is tested) without the data layer. It deliberately shows school-level information only:
 * orders belong to schools, not to individual students.
 */
export function OrderDetailView({ order, updater }: { order: AdminOrder; updater?: ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminCard>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-ink">Order reference</p>
            <h2 className="mt-1 break-all font-mono text-2xl font-extrabold text-navy-900" data-testid="order-ref">{order.orderNo}</h2>
            <p className="mt-1 text-sm text-muted-ink">{order.service} · {order.schoolName}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-muted-ink">Current status</p>
            <div className="mt-1" data-testid="order-status">
              <OrderStatusBadge status={order.status} />
            </div>
          </div>
        </div>
        <p className="border-t bg-royal-50 px-4 py-3 text-sm font-medium text-royal-700 sm:px-6">What customers see: {STATUS_MESSAGE[order.status]}</p>
      </AdminCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminCard title="Progress" className="xl:col-span-2">
          <div className="p-4 sm:p-6">
            <OrderTimeline status={order.status} />
          </div>
        </AdminCard>

        <AdminCard title="Order information">
          <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-6">
            <Field label="School / customer">
              {order.schoolId ? (
                <Link to={`/admin/schools/${order.schoolId}`} className="rounded text-navy-900 underline-offset-2 hover:text-royal-600 hover:underline">
                  {order.schoolName}
                </Link>
              ) : (
                order.schoolName
              )}
            </Field>
            <Field label="School code">{order.schoolCode ?? <span className="font-normal text-muted-ink">Not available</span>}</Field>
            <Field label="Service">{order.service}</Field>
            <Field label="Quantity">{order.quantity.toLocaleString('en-IN')}</Field>
            <Field label="Order date">{formatDate(order.orderDate)}</Field>
            <Field label="Expected delivery">{formatDate(order.expectedDelivery)}</Field>
            {order.updatedAt && <Field label="Status last changed">{formatDateTime(order.updatedAt)}</Field>}
            {order.notes && <Field label="Internal note (never shown publicly)">{order.notes}</Field>}
          </dl>
          <p className="border-t px-4 py-3 text-xs text-muted-ink sm:px-6">
            Orders are placed for a school, not for individual students.{' '}
            <Link to={`/job-status?ref=${encodeURIComponent(order.orderNo)}`} className="inline-flex items-center gap-1 font-medium text-royal-700 hover:underline">
              Open on the public tracking page <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </p>
        </AdminCard>

        {updater && (
          <AdminCard title="Update status">
            <div className="p-4 sm:p-6">{updater}</div>
          </AdminCard>
        )}

        <AdminCard title="Status history" className="xl:col-span-2">
          <div className="p-4 sm:p-6">
            <OrderHistory order={order} />
          </div>
        </AdminCard>
      </div>
    </div>
  )
}
