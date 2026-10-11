import { Eye } from 'lucide-react'
import type { Column } from '@/components/admin/DataTable'
import { FileReviewBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { formatBytes, formatDateTime } from '@/lib/format'
import type { AdminFile } from '@/services/types'
import { FILE_CATEGORY_LABEL } from '@/types'

export const NO_SCHOOL = 'No school recorded'
const NOT_GIVEN = 'Not given (older upload)'

/** First characters of the description, on one line. The full text is in the detail view. */
export const descriptionPreview = (text: string | undefined, max = 70) => {
  if (!text) return ''
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

/** `onOpen` opens the detail dialog. The file name itself is a button, so the whole row is keyboard reachable. */
export const fileColumns = (onOpen: (f: AdminFile) => void): Column<AdminFile>[] => [
  {
    key: 'file',
    header: 'Submission',
    cell: (f) => (
      <span className="min-w-0">
        <button
          type="button"
          onClick={() => onOpen(f)}
          className="-my-3 inline-flex min-h-11 max-w-full items-center rounded text-left font-semibold text-navy-900 [overflow-wrap:anywhere] hover:text-royal-600 hover:underline"
        >
          {f.originalName}
        </button>
        <span className="block font-mono text-xs font-normal text-muted-ink">
          {f.referenceNo} · {formatBytes(f.sizeBytes)}
        </span>
        {f.description && <span className="mt-0.5 block max-w-xs text-xs font-normal text-ink">{descriptionPreview(f.description)}</span>}
      </span>
    ),
  },
  { key: 'school', header: 'School', cell: (f) => f.schoolName ?? <span className="font-normal text-muted-ink">{NO_SCHOOL}</span> },
  { key: 'contact', header: 'Contact person', cell: (f) => f.contactPerson ?? <span className="font-normal text-muted-ink">{NOT_GIVEN}</span> },
  { key: 'category', header: 'Category', cell: (f) => (f.category ? FILE_CATEGORY_LABEL[f.category] : <span className="font-normal text-muted-ink">-</span>) },
  { key: 'review', header: 'Review', cell: (f) => <FileReviewBadge status={f.reviewStatus} /> },
  { key: 'uploaded', header: 'Submitted', cell: (f) => formatDateTime(f.uploadedAt), className: 'whitespace-nowrap' },
]

export const fileRowActions = (onOpen: (f: AdminFile) => void) => (f: AdminFile, context: 'table' | 'card') =>
  context === 'table' ? (
    <Button variant="ghost" size="icon" className="size-9" title="Review" aria-label={`Review ${f.originalName}`} onClick={() => onOpen(f)}>
      <Eye />
    </Button>
  ) : (
    <Button variant="outline" className="h-11 w-full" aria-label={`Review ${f.originalName}`} onClick={() => onOpen(f)}>
      <Eye /> Review
    </Button>
  )
