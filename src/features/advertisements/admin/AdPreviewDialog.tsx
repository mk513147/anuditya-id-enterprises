import { StatusBadge } from '@/components/admin/StatusBadge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { AdminAdvertisement } from '@/services/types'
import { AdCard } from '../AdCard'
import { scheduleText } from './adColumns'
import { publicStatusNote } from './adStatus'

/** Presentational: the card exactly as the public sees it, plus whether (and why not) it is public right now. */
export function AdPreview({ ad }: { ad: AdminAdvertisement }) {
  return (
    <div className="space-y-4">
      <p role="status" className={`rounded-lg px-3 py-2 text-sm font-medium ${ad.visibility === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-gold-100 text-navy-900'}`}>
        {publicStatusNote(ad)}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-ink">
        <StatusBadge tone={ad.isPublished ? 'green' : 'neutral'}>{ad.isPublished ? 'Published' : 'Draft'}</StatusBadge>
        <StatusBadge tone={ad.active ? 'green' : 'neutral'}>{ad.active ? 'Enabled' : 'Disabled'}</StatusBadge>
        <span>Schedule: {scheduleText(ad)}</span>
      </div>
      <div className="max-w-md" data-testid="ad-preview-card">
        <AdCard ad={ad} layout="vertical" />
      </div>
    </div>
  )
}

/** `ad` null = closed. */
export function AdPreviewDialog({ ad, onClose }: { ad: AdminAdvertisement | null; onClose: () => void }) {
  return (
    <Dialog open={!!ad} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>How this advertisement looks on the public Advertisements page.</DialogDescription>
        </DialogHeader>
        {ad && <AdPreview ad={ad} />}
      </DialogContent>
    </Dialog>
  )
}
