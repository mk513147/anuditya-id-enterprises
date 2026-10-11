import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatDate } from '@/lib/format'
import { FILE_REVIEW_LABEL, FILE_REVIEW_STATUSES, type School } from '@/types'
import { ACCEPTED_EXTENSIONS } from '@/validations/upload'
import type { FileFilters as Filters } from './useFileFilters'

interface Props {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  clear: () => void
  schools: School[]
  hasActiveFilters: boolean
}

const label = 'mb-1.5 block text-sm'

export function FileFilters({ filters, update, clear, schools, hasActiveFilters }: Props) {
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

  const schoolName = (id: string) => (id === 'none' ? 'No school recorded' : (schools.find((s) => s.id === id)?.name ?? 'Unknown school'))
  const chips = [
    filters.q && { key: 'q', text: `Search: “${filters.q}”`, remove: () => { setText(''); update({ q: '' }) } },
    filters.school && { key: 'school', text: `School: ${schoolName(filters.school)}`, remove: () => update({ school: '' }) },
    filters.review !== 'all' && { key: 'review', text: `Review: ${FILE_REVIEW_LABEL[filters.review]}`, remove: () => update({ review: 'all' }) },
    filters.type !== 'all' && { key: 'type', text: `Type: .${filters.type}`, remove: () => update({ type: 'all' }) },
    filters.from && { key: 'from', text: `From: ${formatDate(filters.from)}`, remove: () => update({ from: '' }) },
    filters.to && { key: 'to', text: `To: ${formatDate(filters.to)}`, remove: () => update({ to: '' }) },
  ].filter(Boolean) as { key: string; text: string; remove: () => void }[]

  return (
    <div className="border-b p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1">
          <Label htmlFor="file-search" className={label}>Search</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="file-search" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="File, reference or contact person" autoComplete="off" className="h-11 pl-9 text-base" />
          </div>
        </div>
        <div>
          <Label htmlFor="file-school" className={label}>School</Label>
          <NativeSelect id="file-school" value={filters.school} onChange={(e) => update({ school: e.target.value })}>
            <option value="">All schools</option>
            <option value="none">No school recorded</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="file-review" className={label}>Review status</Label>
          <NativeSelect id="file-review" value={filters.review} onChange={(e) => update({ review: e.target.value as Filters['review'] })}>
            <option value="all">Any status</option>
            {FILE_REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{FILE_REVIEW_LABEL[s]}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="file-type" className={label}>File type</Label>
          <NativeSelect id="file-type" value={filters.type} onChange={(e) => update({ type: e.target.value as Filters['type'] })}>
            <option value="all">All types</option>
            {ACCEPTED_EXTENSIONS.map((t) => (
              <option key={t} value={t}>.{t}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="file-from" className={label}>Uploaded from</Label>
            <Input id="file-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} className="block h-11 min-w-0 text-base" />
          </div>
          <div>
            <Label htmlFor="file-to" className={label}>Uploaded to</Label>
            <Input id="file-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} className="block h-11 min-w-0 text-base" />
          </div>
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
