import { Eye } from 'lucide-react'
import type { Column } from '@/components/admin/DataTable'
import { StarRating } from '@/components/shared/StarRating'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { Feedback } from '@/types'
import { FeedbackStatusBadge } from './FeedbackStatusBadge'

export const feedbackColumns = (onOpen: (f: Feedback) => void): Column<Feedback>[] => [
  {
    key: 'name',
    header: 'Submitted by',
    cell: (f) => (
      <span className="min-w-0">
        <button type="button" onClick={() => onOpen(f)} className="-my-3 inline-flex min-h-11 max-w-full items-center rounded text-left font-semibold text-navy-900 [overflow-wrap:anywhere] hover:text-royal-600 hover:underline">
          {f.name}
        </button>
        {f.organization && <span className="block text-xs font-normal text-muted-ink">{f.organization}</span>}
      </span>
    ),
  },
  { key: 'rating', header: 'Rating', cell: (f) => <StarRating value={f.rating} /> },
  { key: 'message', header: 'Message', cell: (f) => <span className="line-clamp-2 max-w-md font-normal">{f.message}</span> },
  { key: 'status', header: 'Status', cell: (f) => <FeedbackStatusBadge status={f.status} /> },
  { key: 'date', header: 'Submitted', cell: (f) => formatDate(f.createdAt), className: 'whitespace-nowrap' },
]

export const feedbackRowActions = (onOpen: (f: Feedback) => void) => (f: Feedback, context: 'table' | 'card') => {
  if (context === 'table') {
    return (
      <Button variant="ghost" size="icon" className="size-9" title="Review" aria-label={`Review feedback from ${f.name}`} onClick={() => onOpen(f)}>
        <Eye />
      </Button>
    )
  }
  return (
    <Button variant="outline" className="h-11 w-full" aria-label={`Review feedback from ${f.name}`} onClick={() => onOpen(f)}>
      <Eye /> Review
    </Button>
  )
}
