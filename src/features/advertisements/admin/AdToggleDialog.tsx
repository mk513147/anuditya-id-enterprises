import { toast } from 'sonner'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import type { AdminAdvertisement } from '@/services/types'
import { useSetAdvertisementActive, useSetAdvertisementPublished } from '../adminHooks'
import { adActionErrorMessage, toggleCopy } from './adStatus'

export type ToggleRequest = { ad: AdminAdvertisement; action: 'publish' | 'enable' } | null

/** Confirms publish / unpublish / enable / disable. `request` null = closed. Buttons lock while the save is pending. */
export function AdToggleDialog({ request, onClose }: { request: ToggleRequest; onClose: () => void }) {
  const setPublished = useSetAdvertisementPublished()
  const setActive = useSetAdvertisementActive()
  const pending = setPublished.isPending || setActive.isPending
  const singleFlight = useSingleFlight()
  const copy = request ? toggleCopy(request.ad, request.action) : null

  const confirm = () =>
    singleFlight(async () => {
      if (!request) return
      const { ad, action } = request
      try {
        if (action === 'publish') await setPublished.mutateAsync({ id: ad.id, published: !ad.isPublished })
        else await setActive.mutateAsync({ id: ad.id, active: !ad.active })
        toast.success('Saved', { description: `${ad.title}: ${copy?.done}. The public pages use the new setting straight away.` })
      } catch (e) {
        toast.error(adActionErrorMessage(e))
      } finally {
        onClose()
      }
    })

  return (
    <ConfirmDialog
      open={!!request}
      onOpenChange={(o) => !o && onClose()}
      title={copy?.title ?? ''}
      description={<p>{copy?.body}</p>}
      confirmLabel={copy?.confirm ?? 'Confirm'}
      destructive={copy?.destructive}
      loading={pending}
      onConfirm={() => void confirm()}
    />
  )
}
