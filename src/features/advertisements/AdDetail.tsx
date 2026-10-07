import { CalendarClock } from 'lucide-react'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { advertisementValidityLabel } from '@/lib/advertisements'
import { waMessages } from '@/lib/whatsapp'
import type { Advertisement } from '@/types'
import { AdMedia } from './AdMedia'

/** Dialog content below the title/description. Plain markup, so it renders without a dialog around it. */
export function AdDetailBody({ ad }: { ad: Advertisement }) {
  const validity = advertisementValidityLabel(ad)
  return (
    <div className="space-y-4">
      <div className="aspect-[16/9] overflow-hidden rounded-xl">
        <AdMedia ad={ad} className="size-full object-cover" iconClassName="size-10" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {ad.offer && <Badge className="bg-gold-100 text-gold-700 hover:bg-gold-100">{ad.offer}</Badge>}
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-ink">
          <CalendarClock className="size-4" aria-hidden /> {validity ?? 'Available now'}
        </p>
      </div>
      <WhatsAppButton size="lg" className="w-full sm:w-auto" label="Enquire on WhatsApp" message={waMessages.ad(ad.whatsappMessage)} />
    </div>
  )
}

/** `ad` null = closed. Focus returns to the "View details" button that opened it (shared dialog behaviour). */
export function AdDetailDialog({ ad, onClose }: { ad: Advertisement | null; onClose: () => void }) {
  return (
    <Dialog open={!!ad} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        {ad && (
          <>
            <DialogHeader>
              <DialogTitle className="text-balance text-xl">{ad.title}</DialogTitle>
              <DialogDescription>{ad.description}</DialogDescription>
            </DialogHeader>
            <AdDetailBody ad={ad} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
