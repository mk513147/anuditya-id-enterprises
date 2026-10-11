import { createElement } from 'react'
import { Eye, Pencil, Power, PowerOff } from 'lucide-react'
import type { Column } from '@/components/admin/DataTable'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { getIcon } from '@/lib/icons'
import type { Service } from '@/types'
import { categoryLabel } from './serviceStatus'

export type ServiceAction = 'preview' | 'edit' | 'toggle'
export type ServiceActionHandler = (service: Service, action: ServiceAction) => void

export const serviceColumns = (on: ServiceActionHandler): Column<Service>[] => [
  {
    key: 'title',
    header: 'Service',
    cell: (s) => (
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-royal-50 text-royal-600">
          {createElement(getIcon(s.icon), { className: 'size-5' })}
        </span>
        <span className="min-w-0">
          <button type="button" onClick={() => on(s, 'preview')} className="-my-3 inline-flex min-h-11 max-w-full items-center rounded text-left font-semibold text-navy-900 [overflow-wrap:anywhere] hover:text-royal-600 hover:underline">
            {s.title}
          </button>
          <span className="block text-xs font-normal text-muted-ink">{s.tagline}</span>
        </span>
      </span>
    ),
  },
  { key: 'category', header: 'Category', cell: (s) => categoryLabel(s.category) },
  { key: 'status', header: 'Status', cell: (s) => <StatusBadge tone={s.enabled ? 'green' : 'neutral'}>{s.enabled ? 'Enabled' : 'Disabled'}</StatusBadge> },
  { key: 'image', header: 'Image', cell: (s) => (s.image ? 'Linked' : <span className="font-normal text-muted-ink">Placeholder</span>) },
  { key: 'order', header: 'Position', cell: (s) => s.order },
]

export const serviceRowActions = (on: ServiceActionHandler) => (s: Service, context: 'table' | 'card') => {
  const ToggleIcon = s.enabled ? PowerOff : Power
  const toggleLabel = s.enabled ? 'Disable' : 'Enable'
  if (context === 'table') {
    return (
      <div className="flex justify-end gap-0.5">
        <Button variant="ghost" size="icon" className="size-9" title="Preview" aria-label={`Preview ${s.title}`} onClick={() => on(s, 'preview')}>
          <Eye />
        </Button>
        <Button variant="ghost" size="icon" className="size-9" title="Edit" aria-label={`Edit ${s.title}`} onClick={() => on(s, 'edit')}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon" className="size-9" title={toggleLabel} aria-label={`${toggleLabel} ${s.title}`} onClick={() => on(s, 'toggle')}>
          <ToggleIcon className={s.enabled ? 'text-destructive' : 'text-emerald-700'} />
        </Button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" className="h-11 px-2" aria-label={`Preview ${s.title}`} onClick={() => on(s, 'preview')}>
        <Eye /> Preview
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`Edit ${s.title}`} onClick={() => on(s, 'edit')}>
        <Pencil /> Edit
      </Button>
      <Button variant="outline" className="h-11 px-2" aria-label={`${toggleLabel} ${s.title}`} onClick={() => on(s, 'toggle')}>
        <ToggleIcon className={s.enabled ? 'text-destructive' : 'text-emerald-700'} /> {toggleLabel}
      </Button>
    </div>
  )
}
