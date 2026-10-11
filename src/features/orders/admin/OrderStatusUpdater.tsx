import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { OrderStatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import type { AdminOrder } from '@/services/types'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { ORDER_STATUSES, type OrderStatus } from '@/types'
import { useUpdateOrderStatus } from '../hooks'
import { changeWarning, describeStatusChange, statusErrorMessage } from './statusChange'

/**
 * Explicit, confirmed status change. The select starts on the current status and the button stays disabled
 * until a different stage is chosen; nothing advances on its own. Render with `key={order.status}` so the
 * choice resets after each successful change.
 */
export function OrderStatusUpdater({ order }: { order: AdminOrder }) {
  const [target, setTarget] = useState<OrderStatus>(order.status)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateOrderStatus()
  const singleFlight = useSingleFlight()

  const change = describeStatusChange(order.status, target)
  const warning = changeWarning(change)

  const confirm = () =>
    singleFlight(async () => {
      setError(null)
      try {
        await update.mutateAsync({ id: order.id, status: target })
        toast.success('Order status updated', { description: `${order.orderNo} is now “${target}”. The public Job Status page shows it too.` })
        setConfirming(false)
      } catch (e) {
        const message = statusErrorMessage(e)
        setConfirming(false)
        setError(message)
        toast.error(message)
      }
    })

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <Label htmlFor="order-new-status" className="mb-1.5 block text-sm">Change status to</Label>
          <NativeSelect id="order-new-status" value={target} onChange={(e) => { setTarget(e.target.value as OrderStatus); setError(null) }}>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
                {s === order.status ? ' (current)' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="button" size="lg" disabled={change.direction === 'none'} onClick={() => setConfirming(true)}>
          Update status
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-ink">Choose the stage the order has actually reached. You will be asked to confirm before anything changes.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-red-50 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change order status?"
        description={
          <div className="space-y-3 text-sm">
            <p>
              <strong className="font-mono">{order.orderNo}</strong> for {order.schoolName}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={order.status} /> <span aria-hidden>→</span> <span className="sr-only">changes to</span> <OrderStatusBadge status={target} />
            </p>
            {warning && <p className="rounded-lg bg-gold-100 px-3 py-2 text-navy-900">{warning}</p>}
            <p className="text-muted-ink">The new status is visible straight away to anyone who tracks this order on the public Job Status page.</p>
          </div>
        }
        confirmLabel="Confirm change"
        loading={update.isPending}
        onConfirm={() => void confirm()}
      />
    </div>
  )
}
