import { Eye } from 'lucide-react'
import type { Column } from '@/components/admin/DataTable'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatBytes, formatDateTime } from '@/lib/format'
import type { AdminFile } from '@/services/types'

export const NO_SCHOOL = 'No school recorded'

/** `onOpen` opens the detail dialog. The file name itself is a button, so the whole row is keyboard reachable. */
export const fileColumns = (onOpen: (f: AdminFile) => void): Column<AdminFile>[] => [
  {
    key: 'file',
    header: 'File',
    cell: (f) => (
      <span className="min-w-0">
        <button
          type="button"
          onClick={() => onOpen(f)}
          className="-my-3 inline-flex min-h-11 max-w-full items-center rounded text-left font-semibold text-navy-900 [overflow-wrap:anywhere] hover:text-royal-600 hover:underline"
        >
          {f.originalName}
        </button>
        <span className="block font-mono text-xs font-normal text-muted-ink">{f.referenceNo}</span>
      </span>
    ),
  },
  { key: 'type', header: 'Format', cell: (f) => <StatusBadge tone="blue">{`.${f.type}`}</StatusBadge> },
  { key: 'size', header: 'Size', cell: (f) => formatBytes(f.sizeBytes), className: 'whitespace-nowrap' },
  { key: 'school', header: 'School', cell: (f) => f.schoolName ?? <span className="font-normal text-muted-ink">{NO_SCHOOL}</span> },
  { key: 'uploaded', header: 'Uploaded', cell: (f) => formatDateTime(f.uploadedAt), className: 'whitespace-nowrap' },
]

export const fileRowActions = (onOpen: (f: AdminFile) => void) => (f: AdminFile, context: 'table' | 'card') =>
  context === 'table' ? (
    <Button variant="ghost" size="icon" className="size-9" title="View details" aria-label={`View details of ${f.originalName}`} onClick={() => onOpen(f)}>
      <Eye />
    </Button>
  ) : (
    <Button variant="outline" className="h-11 w-full" aria-label={`View details of ${f.originalName}`} onClick={() => onOpen(f)}>
      <Eye /> View details
    </Button>
  )
