import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  noun?: string
}

export function Pagination({ page, totalPages, total, pageSize, onPageChange, noun = 'results' }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-sm text-muted-ink" aria-live="polite">
        Showing <strong className="text-ink">{from}–{to}</strong> of <strong className="text-ink">{total}</strong> {noun}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:justify-end">
        <Button variant="outline" className="h-11 min-w-0 px-3" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft aria-hidden /> <span className="sr-only min-[400px]:not-sr-only">Previous</span>
        </Button>
        <span className="text-center text-sm font-medium text-ink sm:min-w-24">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" className="h-11 min-w-0 px-3" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <span className="sr-only min-[400px]:not-sr-only">Next</span> <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  )
}
