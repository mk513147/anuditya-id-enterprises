import { useState } from 'react'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { StatCard } from '@/components/admin/StatCard'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { useSchools } from '@/features/schools/hooks'
import { useAdminFiles } from '@/features/uploads/adminHooks'
import { FileDetailDialog } from '@/features/uploads/admin/FileDetailDialog'
import { FileFilters } from '@/features/uploads/admin/FileFilters'
import { fileColumns, fileRowActions } from '@/features/uploads/admin/fileColumns'
import { fileStatGroups } from '@/features/uploads/admin/fileStats'
import { toFileListParams, useFileFilters } from '@/features/uploads/admin/useFileFilters'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatBytes } from '@/lib/format'
import { dataSource } from '@/services'
import { isRepositoryError } from '@/services/errors'

const PAGE_SIZE = 10

export function AdminFilesPage() {
  usePageTitle('Files – Admin')
  const { filters, update, clear, hasActiveFilters } = useFileFilters()
  const { data, error, isPending, isError, isFetching, refetch } = useAdminFiles(toFileListParams(filters, PAGE_SIZE))
  const { data: schools = [] } = useSchools({})
  const [openId, setOpenId] = useState<string | null>(null)
  const stats = data ? fileStatGroups(data.counts) : undefined
  const columns = fileColumns((f) => setOpenId(f.id))

  return (
    <>
      <AdminPageHeader
        description={
          data ? (
            <span aria-live="polite">
              <strong className="text-ink" data-testid="total-count">{data.total}</strong> {data.total === 1 ? 'file matches' : 'files match'} the current view.{dataSource === 'mock' && ' Demo data keeps only the details of each upload, not the files themselves.'}
            </span>
          ) : (
            'Review the spreadsheets that have been uploaded.'
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard loading={isPending} label="Total files" value={stats?.total} icon="files" tone="blue" hint={stats ? `${formatBytes(stats.totalBytes)} in total` : undefined} />
        <StatCard loading={isPending} label="Excel files" value={stats?.excel} icon="upload" tone="green" hint=".xlsx and .xls" />
        <StatCard loading={isPending} label="CSV files" value={stats?.csv} icon="receipt" tone="gold" hint=".csv" />
      </div>

      <AdminCard>
        <FileFilters filters={filters} update={update} clear={clear} schools={schools} hasActiveFilters={hasActiveFilters} />

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
            <ErrorState message="Could not load files." onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading files">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.total === 0 ? (
          <div className="p-6 sm:p-10">
            {hasActiveFilters ? (
              <EmptyState
                title="No files match these filters"
                text="Try changing or removing a filter."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No files yet" text="Files appear here after they are uploaded on the public File Upload page." />
            )}
          </div>
        ) : (
          <>
            <DataTable caption="Uploaded files" columns={columns} rows={data.items} rowKey={(f) => f.id} busy={isFetching} actions={fileRowActions((f) => setOpenId(f.id))} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} noun="files" onPageChange={(page) => update({ page })} />
          </>
        )}
      </AdminCard>

      <FileDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
