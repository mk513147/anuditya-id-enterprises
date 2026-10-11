import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AdminPageHeader, AdminCard } from '@/components/admin/AdminPageHeader'
import { DataTable } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { StatCard } from '@/components/admin/StatCard'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { useAdminOrders } from '@/features/orders/hooks'
import { OrderCreateDialog } from '@/features/orders/admin/OrderCreateDialog'
import { OrderFilters } from '@/features/orders/admin/OrderFilters'
import { adminOrderColumns, orderRowActions } from '@/features/orders/admin/orderColumns'
import { orderStatGroups } from '@/features/orders/admin/orderStats'
import { toOrderListParams, useOrderFilters } from '@/features/orders/admin/useOrderFilters'
import { usePageTitle } from '@/hooks/usePageTitle'
import { describeError } from '@/services/errors'

const PAGE_SIZE = 10

export function AdminOrdersPage() {
  usePageTitle('Orders – Admin')
  const { filters, update, clear, hasActiveFilters } = useOrderFilters()
  const { data, isPending, isError, error, isFetching, refetch } = useAdminOrders(toOrderListParams(filters, PAGE_SIZE))
  const [creating, setCreating] = useState(false)
  const stats = data ? orderStatGroups(data.counts) : undefined

  return (
    <>
      <AdminPageHeader
        description={
          data ? (
            <span aria-live="polite">
              <strong className="text-ink" data-testid="total-count">{data.total}</strong> {data.total === 1 ? 'order matches' : 'orders match'} the current view. Open an order to see its progress and change its status.
            </span>
          ) : (
            'Find an order, check its progress and update its status.'
          )
        }
        actions={
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus aria-hidden /> New order
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard loading={isPending} label="Total orders" value={stats?.total} icon="orders" tone="blue" />
        <StatCard loading={isPending} label="Awaiting start" value={stats?.awaitingStart} icon="timer" tone="orange" hint="Received or in data verification" />
        <StatCard loading={isPending} label="In production" value={stats?.inProduction} icon="printer" tone="purple" hint="Designing, printing or quality check" />
        <StatCard loading={isPending} label="Ready or dispatched" value={stats?.readyOrDispatched} icon="truck" tone="gold" />
        <StatCard loading={isPending} label="Delivered" value={stats?.delivered} icon="shield-check" tone="green" />
      </div>

      <AdminCard>
        <OrderFilters filters={filters} update={update} clear={clear} hasActiveFilters={hasActiveFilters} />

        {isError ? (
          <div className="p-6">
            <ErrorState message={describeError(error, 'Could not load orders.')} onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading orders">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.total === 0 ? (
          <div className="p-6 sm:p-10">
            {hasActiveFilters ? (
              <EmptyState
                title="No orders match these filters"
                text="Try changing or removing a filter."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No orders yet" text="Orders appear here once they have been created." />
            )}
          </div>
        ) : (
          <>
            <DataTable caption="Orders" columns={adminOrderColumns} rows={data.items} rowKey={(o) => o.id} busy={isFetching} actions={orderRowActions} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} noun="orders" onPageChange={(page) => update({ page })} />
          </>
        )}
      </AdminCard>

      <OrderCreateDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}
