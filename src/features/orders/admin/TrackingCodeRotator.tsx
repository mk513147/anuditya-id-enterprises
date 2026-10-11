import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AdminCard } from '@/components/admin/AdminPageHeader'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { describeError } from '@/services/errors'
import type { AdminOrder } from '@/services/types'
import { useRotateTrackingCode } from '../hooks'
import { TrackingCodeReveal } from './TrackingCodeReveal'

/**
 * Tracking codes are stored only as a hash, so an existing code cannot be shown. The administrator can issue a new one
 * (e.g. the customer lost it); the old code stops working immediately.
 */
export function TrackingCodeRotator({ order }: { order: AdminOrder }) {
  const rotate = useRotateTrackingCode()
  const [confirming, setConfirming] = useState(false)
  const [code, setCode] = useState<string | null>(null)

  const issue = async () => {
    try {
      setCode(await rotate.mutateAsync(order.id))
      setConfirming(false)
    } catch (e) {
      setConfirming(false)
      toast.error(describeError(e, 'Could not issue a new tracking code. Please try again.'))
    }
  }

  return (
    <AdminCard title="Customer tracking code">
      <div className="space-y-3 p-4 sm:p-6">
        {code ? (
          <>
            <TrackingCodeReveal orderNo={order.orderNo} code={code} />
            <Button variant="ghost" className="h-10" onClick={() => setCode(null)}>Hide code</Button>
          </>
        ) : (
          <>
            <p className="text-sm text-ink">
              Customers track this order with its number <strong className="font-mono">{order.orderNo}</strong> and a private tracking code. The code was shown once when the
              order was created and is not stored in readable form.
            </p>
            <Button variant="outline" className="h-11" onClick={() => setConfirming(true)}>
              <KeyRound aria-hidden /> Issue new tracking code
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Issue a new tracking code?"
        description="The customer's current tracking code will stop working straight away. You will need to give them the new code."
        confirmLabel="Issue new code"
        loading={rotate.isPending}
        onConfirm={() => void issue()}
      />
    </AdminCard>
  )
}
