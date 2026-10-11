import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import type { Service } from '@/types'
import { useSetServiceEnabled } from '../adminHooks'
import { serviceActionErrorMessage, toggleCopy } from './serviceStatus'

/** Confirms enabling / disabling. `service` null = closed. Buttons lock while the save is pending. */
export function ServiceToggleDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const setEnabled = useSetServiceEnabled()
  const singleFlight = useSingleFlight()
  const copy = service ? toggleCopy(service) : null

  const confirm = () =>
    singleFlight(async () => {
      if (!service) return
      try {
        await setEnabled.mutateAsync({ id: service.id, enabled: !service.enabled })
        toast.success('Saved', { description: `${service.title}: ${copy?.done}. The public pages use the new setting straight away.` })
      } catch (e) {
        toast.error(serviceActionErrorMessage(e))
      } finally {
        onClose()
      }
    })

  return (
    <ConfirmDialog
      open={!!service}
      onOpenChange={(o) => !o && onClose()}
      title={copy?.title ?? ''}
      description={<p>{copy?.body}</p>}
      confirmLabel={copy?.confirm ?? 'Confirm'}
      destructive={copy?.destructive}
      loading={setEnabled.isPending}
      onConfirm={() => void confirm()}
    />
  )
}
