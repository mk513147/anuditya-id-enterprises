import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { StatCard } from '@/components/admin/StatCard'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { useAdminAdvertisements } from '@/features/advertisements/adminHooks'
import { AdFilters } from '@/features/advertisements/admin/AdFilters'
import { AdFormDialog } from '@/features/advertisements/admin/AdFormDialog'
import { AdPreviewDialog } from '@/features/advertisements/admin/AdPreviewDialog'
import { AdToggleDialog, type ToggleRequest } from '@/features/advertisements/admin/AdToggleDialog'
import { adColumns, adRowActions, type AdActionHandler } from '@/features/advertisements/admin/adColumns'
import { toAdListParams, useAdFilters } from '@/features/advertisements/admin/useAdFilters'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isRepositoryError } from '@/services/errors'
import type { AdminAdvertisement } from '@/services/types'

const PAGE_SIZE = 10

export function AdminAdvertisementsPage() {
  usePageTitle('Advertisements – Admin')
  const { filters, update, clear, hasActiveFilters } = useAdFilters()
  const { data, error, isPending, isError, isFetching, refetch } = useAdminAdvertisements(toAdListParams(filters, PAGE_SIZE))
  const [form, setForm] = useState<{ ad?: AdminAdvertisement } | null>(null)
  const [preview, setPreview] = useState<AdminAdvertisement | null>(null)
  const [toggle, setToggle] = useState<ToggleRequest>(null)
  const c = data?.counts

  const onAction: AdActionHandler = (ad, action) => {
    if (action === 'preview') setPreview(ad)
    else if (action === 'edit') setForm({ ad })
    else setToggle({ ad, action })
  }

  return (
    <>
      <AdminPageHeader
        description={
          data ? (
            <span aria-live="polite">
              <strong className="text-ink" data-testid="total-count">{data.total}</strong> {data.total === 1 ? 'advertisement matches' : 'advertisements match'} the current view. Publication and enabled are separate switches: an advertisement is public only when it is published, enabled and inside its dates.
            </span>
          ) : (
            'Create, schedule, publish and hide the offers shown on the website.'
          )
        }
        actions={
          <Button size="lg" onClick={() => setForm({})}>
            <Plus aria-hidden /> Add advertisement
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={isPending} label="Live now" value={c?.live} icon="megaphone" tone="green" hint="Visible to the public" />
        <StatCard loading={isPending} label="Scheduled" value={c?.scheduled} icon="timer" tone="blue" hint="Published, not started yet" />
        <StatCard loading={isPending} label="Hidden" value={c?.hidden} icon="file-pen" tone="gold" hint={c ? `${c.drafts} draft · ${c.disabled} disabled` : undefined} />
        <StatCard loading={isPending} label="Ended" value={c?.ended} icon="receipt" tone="orange" hint="Past their end date" />
      </div>

      <AdminCard>
        <AdFilters filters={filters} update={update} clear={clear} hasActiveFilters={hasActiveFilters} />

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
            <ErrorState message="Could not load advertisements." onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading advertisements">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.total === 0 ? (
          <div className="p-6 sm:p-10">
            {hasActiveFilters ? (
              <EmptyState
                title="No advertisements match these filters"
                text="Try changing or removing a filter."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No advertisements yet" text="Add the first one to show an offer on the website." action={<Button onClick={() => setForm({})}>Add advertisement</Button>} />
            )}
          </div>
        ) : (
          <>
            <DataTable caption="Advertisements" columns={adColumns(onAction)} rows={data.items} rowKey={(a) => a.id} busy={isFetching} actions={adRowActions(onAction)} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} noun="advertisements" onPageChange={(page) => update({ page })} />
          </>
        )}
      </AdminCard>

      <AdFormDialog open={form !== null} onOpenChange={(o) => !o && setForm(null)} ad={form?.ad} />
      <AdPreviewDialog ad={preview} onClose={() => setPreview(null)} />
      <AdToggleDialog request={toggle} onClose={() => setToggle(null)} />
    </>
  )
}
