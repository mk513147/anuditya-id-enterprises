import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatDate } from '@/lib/format'
import { ORDER_STATUSES } from '@/types'
import type { OrderFilters as Filters } from './useOrderFilters'

interface Props {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  clear: () => void
  hasActiveFilters: boolean
}

const label = 'mb-1.5 block text-sm'

export function OrderFilters({ filters, update, clear, hasActiveFilters }: Props) {
  const [text, setText] = useState(filters.q)
  const debounced = useDebouncedValue(text, 300)
  // If the URL is changed from outside (Back button, Clear all), show that in the box too.
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
    filters.status !== 'all' && { key: 'status', text: `Status: ${filters.status}`, remove: () => update({ status: 'all' }) },
    filters.from && { key: 'from', text: `From: ${formatDate(filters.from)}`, remove: () => update({ from: '' }) },
    filters.to && { key: 'to', text: `To: ${formatDate(filters.to)}`, remove: () => update({ to: '' }) },
  ].filter(Boolean) as { key: string; text: string; remove: () => void }[]

  return (
    <div className="border-b p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]">
        <div>
          <Label htmlFor="ord-search" className={label}>Search</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ord-search"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Order reference or school"
              autoComplete="off"
              className="h-11 pl-9 text-base"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="ord-status" className={label}>Status</Label>
          <NativeSelect id="ord-status" value={filters.status} onChange={(e) => update({ status: e.target.value as Filters['status'] })}>
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ord-from" className={label}>Ordered from</Label>
          <Input id="ord-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} className="block h-11 text-base" />
        </div>
        <div>
          <Label htmlFor="ord-to" className={label}>Ordered to</Label>
          <Input id="ord-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} className="block h-11 text-base" />
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
