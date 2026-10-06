import { ChevronDown, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { School } from '@/types'
import { CLASS_OPTIONS } from '@/validations/student'
import { DEFAULT_STATUS, type StudentFilters as Filters } from './useStudentFilters'

interface Props {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  clear: () => void
  schools: School[]
  sections: string[]
  hasActiveFilters: boolean
}

const label = 'mb-1.5 block text-sm'

export function StudentFilters({ filters, update, clear, schools, sections, hasActiveFilters }: Props) {
  const [text, setText] = useState(filters.q)
  const debounced = useDebouncedValue(text, 300)
  // If the URL is changed from outside (sidebar link, Back button, Clear all), show that in the box too.
  const [seenQ, setSeenQ] = useState(filters.q)
  if (filters.q !== seenQ) {
    setSeenQ(filters.q)
    if (filters.q !== debounced) setText(filters.q)
  }
  // On phones the secondary filters are tucked behind a toggle; from md up they are always visible.
  const [moreOpen, setMoreOpen] = useState(false)

  // Push the debounced search into the URL (which resets to page 1).
  useEffect(() => {
    if (debounced !== filters.q) update({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the debounced text changing
  }, [debounced])

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? 'Unknown school'
  const chips: { key: string; text: string; remove: () => void }[] = [
    filters.q && { key: 'q', text: `Search: “${filters.q}”`, remove: () => { setText(''); update({ q: '' }) } },
    filters.school && { key: 'school', text: `School: ${schoolName(filters.school)}`, remove: () => update({ school: '' }) },
    filters.cls && { key: 'cls', text: `Class: ${filters.cls}`, remove: () => update({ cls: '' }) },
    filters.section && { key: 'section', text: `Section: ${filters.section}`, remove: () => update({ section: '' }) },
    filters.status !== DEFAULT_STATUS && { key: 'status', text: `Status: ${filters.status === 'all' ? 'Active and archived' : 'Archived'}`, remove: () => update({ status: DEFAULT_STATUS }) },
    filters.from && { key: 'from', text: `From: ${formatDate(filters.from)}`, remove: () => update({ from: '' }) },
    filters.to && { key: 'to', text: `To: ${formatDate(filters.to)}`, remove: () => update({ to: '' }) },
  ].filter(Boolean) as { key: string; text: string; remove: () => void }[]

  const secondary = cn('gap-3 sm:grid-cols-2 lg:grid-cols-4', moreOpen ? 'grid' : 'hidden md:grid')

  return (
    <div className="border-b p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_11rem]">
        <div>
          <Label htmlFor="stu-search" className={label}>Search</Label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="stu-search"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Name, reference, admission or roll no."
              autoComplete="off"
              className="h-11 pl-9 text-base"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="stu-school" className={label}>School</Label>
          <NativeSelect id="stu-school" value={filters.school} onChange={(e) => update({ school: e.target.value })}>
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isActive ? '' : ' (inactive)'}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="stu-status" className={label}>Status</Label>
          <NativeSelect id="stu-status" value={filters.status} onChange={(e) => update({ status: e.target.value as Filters['status'] })}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All students</option>
          </NativeSelect>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-2 h-11 px-2 md:hidden"
        aria-expanded={moreOpen}
        aria-controls="stu-more-filters"
        onClick={() => setMoreOpen((o) => !o)}
      >
        <ChevronDown className={cn('transition-transform', moreOpen && 'rotate-180')} aria-hidden />
        {moreOpen ? 'Fewer filters' : 'More filters (class, section, date)'}
      </Button>

      <div id="stu-more-filters" className={cn(secondary, 'md:mt-3')}>
        <div>
          <Label htmlFor="stu-class" className={label}>Class</Label>
          <NativeSelect id="stu-class" value={filters.cls} onChange={(e) => update({ cls: e.target.value })}>
            <option value="">All classes</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="stu-section" className={label}>Section</Label>
          <NativeSelect id="stu-section" value={filters.section} onChange={(e) => update({ section: e.target.value })}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <Label htmlFor="stu-from" className={label}>Submitted from</Label>
          <Input id="stu-from" type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} className="block h-11 text-base" />
        </div>
        <div>
          <Label htmlFor="stu-to" className={label}>Submitted to</Label>
          <Input id="stu-to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} className="block h-11 text-base" />
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
