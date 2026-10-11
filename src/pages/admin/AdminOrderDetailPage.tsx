import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { OrderDetailView } from '@/features/orders/admin/OrderDetailView'
import { OrderStatusUpdater } from '@/features/orders/admin/OrderStatusUpdater'
import { useAdminOrder } from '@/features/orders/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isRepositoryError } from '@/services/errors'

export function AdminOrderDetailPage() {
  const { orderId = '' } = useParams()
  const { data, isPending, isError, error, refetch } = useAdminOrder(orderId)
  usePageTitle(data ? `${data.orderNo} – Admin` : 'Order – Admin')

  const back = (
    <Button asChild variant="ghost" className="-ml-3 mb-4 h-11">
      <Link to="/admin/orders">
        <ArrowLeft aria-hidden /> All orders
      </Link>
    </Button>
  )

  if (isPending) {
    return (
      <>
        {back}
        <div className="space-y-4" aria-busy="true" aria-label="Loading order">
          <SkeletonBlock className="h-32" />
          <SkeletonBlock className="h-56" />
        </div>
      </>
    )
  }
  if (isError) {
    const missing = isRepositoryError(error, 'not_found') || isRepositoryError(error, 'invalid_id')
    return (
      <>
        {back}
        <ErrorState
          message={missing ? 'This order could not be found. The link may be wrong or the order may no longer exist.' : 'Could not load this order.'}
          onRetry={missing ? undefined : () => void refetch()}
        />
      </>
    )
  }

  return (
    <>
      {back}
      <OrderDetailView order={data} updater={<OrderStatusUpdater key={data.status} order={data} />} />
    </>
  )
}
