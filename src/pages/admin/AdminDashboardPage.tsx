import { Plus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { StatCard } from '@/components/admin/StatCard'
import { ActiveBadge, OrderStatusBadge } from '@/components/admin/StatusBadge'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDashboard } from '@/features/admin/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate } from '@/lib/format'
import type { Order } from '@/types'

const orderColumns: Column<Order>[] = [
  { key: 'no', header: 'Order', cell: (o) => <span className="font-mono text-[13px]">{o.orderNo}</span>, className: 'whitespace-nowrap' },
  { key: 'customer', header: 'School / customer', cell: (o) => o.customer },
  { key: 'service', header: 'Service', cell: (o) => o.service },
  { key: 'qty', header: 'Qty', cell: (o) => o.quantity.toLocaleString('en-IN'), className: 'tabular-nums' },
  { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
  { key: 'due', header: 'Expected', cell: (o) => formatDate(o.expectedDelivery), className: 'whitespace-nowrap' },
]

export function AdminDashboardPage() {
  usePageTitle('Dashboard – Admin')
  const navigate = useNavigate()
  const { data, isPending, isError, refetch } = useDashboard()
  const c = data?.counts

  return (
    <>
      <AdminPageHeader
        description={
          <span className="flex flex-wrap items-center gap-2">
            Overview of schools, students, orders and files.
            <Badge variant="outline" className="border-gold-500/60 bg-gold-100 text-gold-700">Demo data</Badge>
          </span>
        }
        actions={
          <>
            <Button size="lg" onClick={() => navigate('/admin/schools', { state: { openAdd: true } })}>
              <Plus aria-hidden /> Add School
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/admin/students">View Students</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/admin/orders">View Orders</Link>
            </Button>
          </>
        }
      />

      {isError ? (
        <ErrorState message="Could not load the dashboard." onRetry={() => void refetch()} />
      ) : (
        <>
          <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard loading={isPending} label="Total schools" value={c?.totalSchools} icon="school" tone="blue" to="/admin/schools" />
            <StatCard loading={isPending} label="Active schools" value={c?.activeSchools} icon="shield-check" tone="green" hint="Accepting submissions" to="/admin/schools" />
            <StatCard loading={isPending} label="Total students" value={c?.totalStudents} icon="users" tone="purple" to="/admin/students" />
            <StatCard loading={isPending} label="Pending orders" value={c?.pendingOrders} icon="timer" tone="orange" hint="Received or in data verification" to="/admin/orders" />
            <StatCard loading={isPending} label="Uploaded files" value={c?.uploadedFiles} icon="files" tone="gold" to="/admin/files" />
            <StatCard loading={isPending} label="Awaiting completion" value={c?.awaitingCompletion} icon="orders" tone="blue" hint="Orders not yet delivered" to="/admin/orders" />
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <AdminCard
              title="Recent orders"
              action={
                <Button asChild variant="ghost" size="sm" className="h-10">
                  <Link to="/admin/orders">View all</Link>
                </Button>
              }
            >
              {isPending ? (
                <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading orders">
                  {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-12" />)}
                </div>
              ) : data.recentOrders.length === 0 ? (
                <div className="p-6"><EmptyState title="No orders yet" /></div>
              ) : (
                <DataTable caption="Recent orders" columns={orderColumns} rows={data.recentOrders} rowKey={(o) => o.id} />
              )}
            </AdminCard>

            <AdminCard
              title="Recently added schools"
              action={
                <Button asChild variant="ghost" size="sm" className="h-10">
                  <Link to="/admin/schools">View all</Link>
                </Button>
              }
            >
              {isPending ? (
                <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading schools">
                  {[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-14" />)}
                </div>
              ) : data.recentSchools.length === 0 ? (
                <div className="p-6"><EmptyState title="No schools yet" /></div>
              ) : (
                <ul className="divide-y">
                  {data.recentSchools.map((s) => (
                    <li key={s.id}>
                      <Link to={`/admin/schools/${s.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-royal-50/60 sm:px-5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy-900">{s.name}</span>
                          <span className="block text-xs text-muted-ink">
                            {s.code} · {s.studentCount} {s.studentCount === 1 ? 'student' : 'students'} · {formatDate(s.createdAt)}
                          </span>
                        </span>
                        <ActiveBadge active={s.isActive} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </div>
        </>
      )}
    </>
  )
}
