import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { FeedbackFilters as Filters } from './useFeedbackFilters'

interface Props {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  clear: () => void
  hasActiveFilters: boolean
}

const label = 'mb-1.5 block text-sm'
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' } as const

export function FeedbackFilters({ filters, update, clear, hasActiveFilters }: Props) {
  const [text, setText] = useState(filters.q)
  const debounced = useDebouncedValue(text, 300)
  const [seenQ, setSeenQ] = useState(filters.q)
  if (filters.q !== seenQ) {
    setSeenQ(filters.q)
    if (filters.q !== debounced) setText(filters.q)
  }

  useEffect(() => {
    if (debounced !== filters.q) update({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text changing
  }, [debounced])

  const chips = [
    filters.q && { key: 'q', text: `Search: “${filters.q}”`, remove: () => { setText(''); update({ q: '' }) } },
    filters.status !== 'all' && { key: 'status', text: `Status: ${STATUS_LABEL[filters.status]}`, remove: () => update({ status: 'all' }) },
    filters.rating && { key: 'rating', text: `Rating: ${filters.rating} star${filters.rating === '1' ? '' : 's'}`, remove: () => update({ rating: '' }) },
  ].filter(Boolean) as { key: string; text: string; remove: () => void }[]

  return (
    <div className="border-b p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="fb-search" className={label}>Search name or message</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="fb-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Name or words in the message" autoComplete="off" className="h-11 pl-9 text-base" />
          </div>
        </div>
        <div>
          <Label htmlFor="fb-status" className={label}>Status</Label>
          <NativeSelect id="fb-status" value={filters.status} onChange={(e) => update({ status: e.target.value as Filters['status'] })}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="fb-rating" className={label}>Rating</Label>
          <NativeSelect id="fb-rating" value={filters.rating} onChange={(e) => update({ rating: e.target.value })}>
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {(chips.length > 0 || hasActiveFilters) && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-royal-50 py-1 pl-3 pr-1 text-sm font-medium text-royal-700 ring-1 ring-inset ring-royal-100">
              {c.text}
              <button type="button" onClick={c.remove} aria-label={`Remove filter ${c.text}`} className="grid size-7 place-items-center rounded-full hover:bg-royal-100">
                <X className="size-4" aria-hidden />
              </button>
            </span>
          ))}
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => { setText(''); clear() }}>
            Clear all filters
          </Button>
        </div>
      )}
    </div>
  )
}
