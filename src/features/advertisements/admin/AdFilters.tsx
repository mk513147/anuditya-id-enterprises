import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatIstDay, istDayStart } from '@/lib/advertisements'
import { VISIBILITY_LABEL } from './adStatus'
import type { AdFilters as Filters } from './useAdFilters'

interface Props {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  clear: () => void
  hasActiveFilters: boolean
}

const label = 'mb-1.5 block text-sm'

export function AdFilters({ filters, update, clear, hasActiveFilters }: Props) {
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
    filters.published !== 'all' && { key: 'published', text: `Publication: ${filters.published === 'published' ? 'Published' : 'Draft'}`, remove: () => update({ published: 'all' }) },
    filters.active !== 'all' && { key: 'active', text: `State: ${filters.active === 'enabled' ? 'Enabled' : 'Disabled'}`, remove: () => update({ active: 'all' }) },
    filters.visibility !== 'all' && { key: 'visibility', text: `Public status: ${VISIBILITY_LABEL[filters.visibility]}`, remove: () => update({ visibility: 'all' }) },
    filters.runsOn && { key: 'runsOn', text: `Running on: ${formatIstDay(istDayStart(filters.runsOn))}`, remove: () => update({ runsOn: '' }) },
  ].filter(Boolean) as { key: string; text: string; remove: () => void }[]

  return (
    <div className="border-b p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="ad-search" className={label}>Search by title</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="ad-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Advertisement title" autoComplete="off" className="h-11 pl-9 text-base" />
          </div>
        </div>
        <div>
          <Label htmlFor="ad-published" className={label}>Publication</Label>
          <NativeSelect id="ad-published" value={filters.published} onChange={(e) => update({ published: e.target.value as Filters['published'] })}>
            <option value="all">Published and drafts</option>
            <option value="published">Published</option>
            <option value="draft">Drafts</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ad-active" className={label}>Enabled</Label>
          <NativeSelect id="ad-active" value={filters.active} onChange={(e) => update({ active: e.target.value as Filters['active'] })}>
            <option value="all">Enabled and disabled</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ad-visibility" className={label}>Public status</Label>
          <NativeSelect id="ad-visibility" value={filters.visibility} onChange={(e) => update({ visibility: e.target.value as Filters['visibility'] })}>
            <option value="all">Any</option>
            {Object.entries(VISIBILITY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="ad-runson" className={label}>Running on date</Label>
          <Input id="ad-runson" type="date" value={filters.runsOn} onChange={(e) => update({ runsOn: e.target.value })} className="block h-11 text-base" />
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
