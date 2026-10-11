import { StatusBadge } from '@/components/admin/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Service } from '@/types'
import { ServiceCard } from '../ServiceCard'
import { categoryLabel, publicStatusNote } from './serviceStatus'

/** Presentational: the real public card (detailed variant, as on /services) plus whether it is public right now. */
export function ServicePreview({ service }: { service: Service }) {
  return (
    <div className="space-y-4">
      <p role="status" className={`rounded-lg px-3 py-2 text-sm font-medium ${service.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gold-100 text-navy-900'}`}>
        {publicStatusNote(service)}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-ink">
        <StatusBadge tone={service.enabled ? 'green' : 'neutral'}>{service.enabled ? 'Enabled' : 'Disabled'}</StatusBadge>
        <span>Category: {categoryLabel(service.category)}</span>
      </div>
      <div className="max-w-sm" data-testid="service-preview-card">
        <ServiceCard service={service} variant="detailed" />
      </div>
    </div>
  )
}

/** `service` null = closed. */
export function ServicePreviewDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>How this service looks on the public Services page.</DialogDescription>
        </DialogHeader>
        {service && <ServicePreview service={service} />}
      </DialogContent>
    </Dialog>
  )
}
