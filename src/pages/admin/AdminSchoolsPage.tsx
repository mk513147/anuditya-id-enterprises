import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ActiveBadge } from '@/components/admin/StatusBadge'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { SchoolFormDialog } from '@/features/schools/components/SchoolFormDialog'
import { SchoolRowActions } from '@/features/schools/components/SchoolRowActions'
import { SchoolStatusDialog } from '@/features/schools/components/SchoolStatusDialog'
import { useSchools } from '@/features/schools/hooks'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/format'
import type { SchoolListParams } from '@/services/types'
import type { School } from '@/types'

type StatusFilter = NonNullable<SchoolListParams['status']>

export function AdminSchoolsPage() {
  usePageTitle('Schools – Admin')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput, 250)
  const [status, setStatus] = useState<StatusFilter>('all')
  // The dashboard's "Add School" button navigates here asking for the dialog to open.
  const [formOpen, setFormOpen] = useState(() => !!(location.state as { openAdd?: boolean } | null)?.openAdd)
  const [editing, setEditing] = useState<School | undefined>()
  const [toggling, setToggling] = useState<School | null>(null)
  const { data, isPending, isError, isFetching, refetch } = useSchools({ search, status })

  useEffect(() => {
    if ((location.state as { openAdd?: boolean } | null)?.openAdd) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

  const openAdd = () => {
    setEditing(undefined)
    setFormOpen(true)
  }
  const openEdit = (s: School) => {
    setEditing(s)
    setFormOpen(true)
  }

  const columns: Column<School>[] = [
    {
      key: 'name',
      header: 'School',
      cell: (s) => (
        <Link to={`/admin/schools/${s.id}`} className="-my-3 inline-flex min-h-11 items-center rounded font-semibold text-navy-900 hover:text-royal-600 hover:underline">
          {s.name}
        </Link>
      ),
    },
    { key: 'code', header: 'Code', cell: (s) => <span className="font-mono text-[13px]">{s.code}</span> },
    {
      key: 'contact',
      header: 'Contact',
      cell: (s) => (
        <span>
          {s.contactPerson}
          <span className="block text-xs text-muted-ink">{s.phone}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (s) => <ActiveBadge active={s.isActive} /> },
    { key: 'created', header: 'Added', cell: (s) => formatDate(s.createdAt) },
  ]

  const filtered = search.trim() !== '' || status !== 'all'

  return (
    <>
      <AdminPageHeader
        description="Add schools, manage their status and share each school's student submission link."
        actions={
          <Button size="lg" onClick={openAdd}>
            <Plus aria-hidden /> Add School
          </Button>
        }
      />

      <AdminCard>
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="min-w-0 flex-1">
            <Label htmlFor="school-search" className="mb-1.5 block text-sm">Search</Label>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="school-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="School name or code"
                autoComplete="off"
                className="h-11 pl-9 text-base"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <Label htmlFor="school-status" className="mb-1.5 block text-sm">Status</Label>
            <NativeSelect id="school-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="all">All schools</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </NativeSelect>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {data ? `${data.length} schools shown` : ''}
        </p>

        {isError ? (
          <div className="p-6">
            <ErrorState message="Could not load schools." onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading schools">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="p-6 sm:p-10">
            {filtered ? (
              <EmptyState
                title="No schools match your search"
                text="Try a different name or code, or clear the filters."
                action={
                  <Button variant="outline" onClick={() => { setSearchInput(''); setStatus('all') }}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No schools yet"
                text="Add your first school to create its student submission link."
                action={
                  <Button onClick={openAdd}>
                    <Plus aria-hidden /> Add School
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <>
            <DataTable
              caption="Schools"
              columns={columns}
              rows={data}
              rowKey={(s) => s.id}
              busy={isFetching}
              actions={(s, ctx) => <SchoolRowActions school={s} context={ctx} onEdit={openEdit} onToggle={setToggling} />}
            />
            <p className="border-t px-4 py-3 text-xs text-muted-ink sm:px-5">
              Showing {data.length} {data.length === 1 ? 'school' : 'schools'}
            </p>
          </>
        )}
      </AdminCard>

      <SchoolFormDialog open={formOpen} onOpenChange={setFormOpen} school={editing} />
      <SchoolStatusDialog school={toggling} onClose={() => setToggling(null)} />
    </>
  )
}
