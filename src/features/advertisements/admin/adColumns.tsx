import { Eye, Pencil, Power, PowerOff, Send, Undo2 } from 'lucide-react'
import type { Column } from '@/components/admin/DataTable'
import { StatusBadge, type BadgeTone } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatIstDay, type AdVisibility } from '@/lib/advertisements'
import type { AdminAdvertisement } from '@/services/types'

const VISIBILITY: Record<AdVisibility, { label: string; tone: BadgeTone }> = {
  live: { label: 'Live now', tone: 'green' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
  ended: { label: 'Ended', tone: 'neutral' },
  hidden: { label: 'Hidden', tone: 'gold' },
}

export type AdAction = 'preview' | 'edit' | 'publish' | 'enable'
export type AdActionHandler = (ad: AdminAdvertisement, action: AdAction) => void

/** "1 Sep 2026 – 31 Dec 2026", "From 1 Sep 2026", "Until 31 Dec 2026" or "No dates set" (India days). */
export function scheduleText(ad: Pick<AdminAdvertisement, 'startsAt' | 'endsAt'>): string {
  if (ad.startsAt && ad.endsAt) return `${formatIstDay(ad.startsAt)} – ${formatIstDay(ad.endsAt)}`
  if (ad.startsAt) return `From ${formatIstDay(ad.startsAt)}`
  if (ad.endsAt) return `Until ${formatIstDay(ad.endsAt)}`
  return 'No dates set'
}

export const adColumns = (on: AdActionHandler): Column<AdminAdvertisement>[] => [
  {
    key: 'title',
    header: 'Advertisement',
    cell: (a) => (
      <span className="min-w-0">
        <button
          type="button"
          onClick={() => on(a, 'preview')}
          className="-my-3 inline-flex min-h-11 max-w-full items-center rounded text-left font-semibold text-navy-900 [overflow-wrap:anywhere] hover:text-royal-600 hover:underline"
        >
          {a.title}
        </button>
        {a.offer && <span className="block text-xs font-normal text-muted-ink">{a.offer}</span>}
      </span>
    ),
  },
  { key: 'published', header: 'Publication', cell: (a) => <StatusBadge tone={a.isPublished ? 'green' : 'neutral'}>{a.isPublished ? 'Published' : 'Draft'}</StatusBadge> },
  { key: 'active', header: 'Enabled', cell: (a) => <StatusBadge tone={a.active ? 'green' : 'neutral'}>{a.active ? 'Enabled' : 'Disabled'}</StatusBadge> },
  { key: 'visibility', header: 'Public status', cell: (a) => <StatusBadge tone={VISIBILITY[a.visibility].tone}>{VISIBILITY[a.visibility].label}</StatusBadge> },
  { key: 'schedule', header: 'Schedule', cell: (a) => scheduleText(a), className: 'whitespace-nowrap' },
]

export const adRowActions = (on: AdActionHandler) => (a: AdminAdvertisement, context: 'table' | 'card') => {
  const PublishIcon = a.isPublished ? Undo2 : Send
  const EnableIcon = a.active ? PowerOff : Power
  const publishLabel = a.isPublished ? 'Unpublish' : 'Publish'
  const enableLabel = a.active ? 'Disable' : 'Enable'
  if (context === 'table') {
    const btn = 'size-9'
    return (
      <div className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon" className={btn} title="Preview" aria-label={`Preview ${a.title}`} onClick={() => on(a, 'preview')}>
          <Eye />
        </Button>
        <Button variant="ghost" size="icon" className={btn} title="Edit" aria-label={`Edit ${a.title}`} onClick={() => on(a, 'edit')}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" className={btn} title={publishLabel} aria-label={`${publishLabel} ${a.title}`} onClick={() => on(a, 'publish')}>
          <PublishIcon />
        </Button>
        <Button variant="ghost" size="icon" className={btn} title={enableLabel} aria-label={`${enableLabel} ${a.title}`} onClick={() => on(a, 'enable')}>
          <EnableIcon className={a.active ? 'text-destructive' : 'text-emerald-700'} />
        </Button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" className="h-11 px-2" aria-label={`Preview ${a.title}`} onClick={() => on(a, 'preview')}>
        <Eye /> Preview
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`Edit ${a.title}`} onClick={() => on(a, 'edit')}>
        <Pencil /> Edit
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`${publishLabel} ${a.title}`} onClick={() => on(a, 'publish')}>
        <PublishIcon /> {publishLabel}
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`${enableLabel} ${a.title}`} onClick={() => on(a, 'enable')}>
        <EnableIcon className={a.active ? 'text-destructive' : 'text-emerald-700'} /> {enableLabel}
      </Button>
    </div>
  )
}
