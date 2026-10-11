import { Copy, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/clipboard'

/**
 * Shows a freshly issued tracking code ONCE. The database stores only a hash, so after this panel is closed the code
 * cannot be shown again (a new one can be issued). It is kept in component memory only: never in the URL, browser
 * storage, the query cache or a log.
 */
export function TrackingCodeReveal({ orderNo, code }: { orderNo: string; code: string }) {
  const copy = async () => {
    const ok = await copyText(`Order: ${orderNo}\nTracking code: ${code}`)
    if (ok) toast.success('Copied', { description: 'Order number and tracking code copied.' })
    else toast.error('Could not copy. Please select the code and copy it manually.')
  }
  return (
    <div className="rounded-xl border border-gold-400/60 bg-gold-100/60 p-4" data-testid="tracking-code-reveal">
      <p className="flex items-center gap-2 text-sm font-semibold text-navy-900">
        <KeyRound className="size-4" aria-hidden /> Tracking code for <span className="font-mono">{orderNo}</span>
      </p>
      <p className="mt-2 select-all break-all rounded-lg bg-white px-3 py-2 text-center font-mono text-lg font-bold tracking-wider text-navy-900" aria-label="Tracking code">
        {code}
      </p>
      <p className="mt-2 text-xs text-ink">
        Give this code to the customer with the order number: they need both to track the order. <strong>It is shown only now.</strong> If it is lost, issue a new one from the order page (the old code then stops working).
      </p>
      <Button type="button" variant="outline" size="sm" className="mt-3 h-10" onClick={() => void copy()}>
        <Copy aria-hidden /> Copy order number and code
      </Button>
    </div>
  )
}
