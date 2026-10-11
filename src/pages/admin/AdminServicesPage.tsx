import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { StatCard } from '@/components/admin/StatCard'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { SERVICE_CATEGORIES } from '@/data/serviceCategories'
import { useAdminServices } from '@/features/services/adminHooks'
import { ServiceFilters } from '@/features/services/admin/ServiceFilters'
import { ServiceFormDialog } from '@/features/services/admin/ServiceFormDialog'
import { ServicePreviewDialog } from '@/features/services/admin/ServicePreviewDialog'
import { ServiceToggleDialog } from '@/features/services/admin/ServiceToggleDialog'
import { serviceColumns, serviceRowActions, type ServiceActionHandler } from '@/features/services/admin/serviceColumns'
import { toServiceListParams, useServiceFilters } from '@/features/services/admin/useServiceFilters'
import { usePageTitle } from '@/hooks/usePageTitle'
import { isRepositoryError } from '@/services/errors'
import type { Service } from '@/types'

const PAGE_SIZE = 10

export function AdminServicesPage() {
  usePageTitle('Services – Admin')
  const { filters, update, clear, hasActiveFilters } = useServiceFilters()
  const { data, error, isPending, isError, isFetching, refetch } = useAdminServices(toServiceListParams(filters, PAGE_SIZE))
  const [form, setForm] = useState<{ service?: Service } | null>(null)
  const [preview, setPreview] = useState<Service | null>(null)
  const [toggle, setToggle] = useState<Service | null>(null)
  const c = data?.counts

  const onAction: ServiceActionHandler = (service, action) => {
    if (action === 'preview') setPreview(service)
    else if (action === 'edit') setForm({ service })
    else setToggle(service)
  }

  return (
    <>
      <AdminPageHeader
        description={
          data ? (
            <span aria-live="polite">
              <strong className="text-ink" data-testid="total-count">{data.total}</strong> {data.total === 1 ? 'service matches' : 'services match'} the current view. Enabled services appear on the Home page, the Services page and the quote form; disabled ones are hidden but never deleted.
            </span>
          ) : (
            'Add, edit and switch on or off the services shown on the website.'
          )
        }
        actions={
          <Button size="lg" onClick={() => setForm({})}>
            <Plus aria-hidden /> Add service
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          loading={isPending}
          label="Total services"
          value={c?.total}
          icon="settings"
          tone="blue"
          hint={c ? SERVICE_CATEGORIES.map((cat) => `${cat.label} ${c.byCategory[cat.id]}`).join(' · ') : undefined}
        />
        <StatCard loading={isPending} label="Enabled" value={c?.enabled} icon="shield-check" tone="green" hint="Shown on the website" />
        <StatCard loading={isPending} label="Disabled" value={c?.disabled} icon="file-pen" tone="gold" hint="Hidden from the website" />
      </div>

      <AdminCard>
        <ServiceFilters filters={filters} update={update} clear={clear} hasActiveFilters={hasActiveFilters} />

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
            <ErrorState message="Could not load services." onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading services">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.total === 0 ? (
          <div className="p-6 sm:p-10">
            {hasActiveFilters ? (
              <EmptyState
                title="No services match these filters"
                text="Try changing or removing a filter."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No services yet" text="Add the first one to show it on the website." action={<Button onClick={() => setForm({})}>Add service</Button>} />
            )}
          </div>
        ) : (
          <>
            <DataTable caption="Services" columns={serviceColumns(onAction)} rows={data.items} rowKey={(s) => s.id} busy={isFetching} actions={serviceRowActions(onAction)} />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} noun="services" onPageChange={(page) => update({ page })} />
          </>
        )}
      </AdminCard>

      <ServiceFormDialog open={form !== null} onOpenChange={(o) => !o && setForm(null)} service={form?.service} />
      <ServicePreviewDialog service={preview} onClose={() => setPreview(null)} />
      <ServiceToggleDialog service={toggle} onClose={() => setToggle(null)} />
    </>
  )
}
