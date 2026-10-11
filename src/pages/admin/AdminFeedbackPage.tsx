import { useState } from 'react'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { StatCard } from '@/components/admin/StatCard'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { useAdminFeedback } from '@/features/feedback/adminHooks'
import { FeedbackDetailDialog } from '@/features/feedback/admin/FeedbackDetailDialog'
import { FeedbackFilters } from '@/features/feedback/admin/FeedbackFilters'
import { feedbackColumns, feedbackRowActions } from '@/features/feedback/admin/feedbackColumns'
import { toFeedbackListParams, useFeedbackFilters } from '@/features/feedback/admin/useFeedbackFilters'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isRepositoryError } from '@/services/errors'

const PAGE_SIZE = 10

export function AdminFeedbackPage() {
  usePageTitle('Feedback – Admin')
  const { filters, update, clear, hasActiveFilters } = useFeedbackFilters()
  const { data, error, isPending, isError, isFetching, refetch } = useAdminFeedback(toFeedbackListParams(filters, PAGE_SIZE))
  const [openId, setOpenId] = useState<string | null>(null)
  const c = data?.counts
  const open = (f: { id: string }) => setOpenId(f.id)

  return (
    <>
      <AdminPageHeader
        description={
          data ? (
            <span aria-live="polite">
              <strong className="text-ink" data-testid="total-count">{data.total}</strong> {data.total === 1 ? 'submission matches' : 'submissions match'} the current view. Pending feedback is listed first. Only approved feedback is shown on the website.
            </span>
          ) : (
            'Review what customers have written and decide what is shown on the website.'
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard loading={isPending} label="Pending" value={c?.pending} icon="timer" tone="gold" hint="Waiting for a decision" />
        <StatCard loading={isPending} label="Approved" value={c?.approved} icon="thumbs-up" tone="green" hint="Shown on the website" />
        <StatCard loading={isPending} label="Rejected" value={c?.rejected} icon="message" tone="orange" hint="Not shown" />
      </div>

      <AdminCard>
        <FeedbackFilters filters={filters} update={update} clear={clear} hasActiveFilters={hasActiveFilters} />

        {isError && isRepositoryError(error, 'invalid_filter') ? (
          <div className="p-6 sm:p-10">
            <EmptyState
              title="These filters cannot be applied"
              text={error.message}
              action={
                <Button variant="outline" onClick={clear}>
                  Clear all filters
                </Button>
              }
            />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState message="Could not load feedback." onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading feedback">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.total === 0 ? (
          <div className="p-6 sm:p-10">
            {hasActiveFilters ? (
              <EmptyState
                title="No feedback matches these filters"
                text="Try changing or removing a filter."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No feedback yet" text="Submissions from the public Feedback page appear here for review." />
            )}
          </div>
        ) : (
          <>
            <DataTable caption="Feedback" columns={feedbackColumns(open)} rows={data.items} rowKey={(f) => f.id} busy={isFetching} actions={feedbackRowActions(open)} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} noun="submissions" onPageChange={(page) => update({ page })} />
          </>
        )}
      </AdminCard>

      <FeedbackDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
