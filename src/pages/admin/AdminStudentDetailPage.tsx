import { Archive, ArchiveRestore, ArrowLeft, Building2, Pencil, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminCard } from '@/components/admin/AdminPageHeader'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { ActiveBadge, OrderStatusBadge, StatusBadge } from '@/components/admin/StatusBadge'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { StudentArchiveDialog } from '@/features/students/admin/StudentArchiveDialog'
import { StudentEditDialog } from '@/features/students/admin/StudentEditDialog'
import { useRestoreStudent, useStudentDetail } from '@/features/students/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { formatDate, formatDateTime } from '@/lib/format'
import type { Order } from '@/types'

const NOT_PROVIDED = <span className="font-normal text-muted-ink">Not provided</span>

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-ink">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-navy-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Group({ title, children, cols = 'sm:grid-cols-2' }: { title: string; children: ReactNode; cols?: string }) {
  return (
    <AdminCard title={title} className="print:shadow-none">
      <dl className={`grid gap-x-6 gap-y-4 p-4 sm:p-6 ${cols}`}>{children}</dl>
    </AdminCard>
  )
}

const orderColumns: Column<Order>[] = [
  { key: 'no', header: 'Order', cell: (o) => <span className="font-mono text-[13px]">{o.orderNo}</span>, className: 'whitespace-nowrap' },
  { key: 'service', header: 'Service', cell: (o) => o.service },
  { key: 'qty', header: 'Qty', cell: (o) => o.quantity.toLocaleString('en-IN') },
  { key: 'status', header: 'Status', cell: (o) => <OrderStatusBadge status={o.status} /> },
  { key: 'date', header: 'Ordered', cell: (o) => formatDate(o.orderDate), className: 'whitespace-nowrap' },
]

export function AdminStudentDetailPage() {
  const { studentId = '' } = useParams()
  const { data, isPending, isError, refetch } = useStudentDetail(studentId)
  const restore = useRestoreStudent()
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  usePageTitle(data ? `${data.student.name} – Admin` : 'Student – Admin')

  const back = (
    <Button asChild variant="ghost" className="-ml-3 mb-4 h-11 print:hidden">
      <Link to="/admin/students">
        <ArrowLeft aria-hidden /> All students
      </Link>
    </Button>
  )

  if (isPending) {
    return (
      <>
        {back}
        <div className="space-y-4" aria-busy="true" aria-label="Loading student">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      </>
    )
  }
  if (isError) {
    return (
      <>
        {back}
        <ErrorState message="This student could not be found. The link may be wrong or the record may no longer exist." onRetry={() => void refetch()} />
      </>
    )
  }

  const { student: s, schoolOrders } = data

  return (
    <>
      {back}

      <AdminCard className="print:shadow-none">
        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-start sm:p-6">
          <div className="shrink-0">
            {s.photoUrl ? (
              <img src={s.photoUrl} alt={`Photo of ${s.name}`} className="h-40 w-32 rounded-xl border object-cover" />
            ) : (
              <div className="grid h-40 w-32 place-items-center rounded-xl border border-dashed bg-surface text-center text-muted-ink" role="img" aria-label="No photo on file">
                <span>
                  <UserRound className="mx-auto size-10" aria-hidden />
                  <span className="mt-1 block px-2 text-xs">No photo on file</span>
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-extrabold">{s.name}</h2>
              <StatusBadge tone={s.isArchived ? 'neutral' : 'green'}>{s.isArchived ? 'Archived' : 'Active'}</StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted-ink">
              Reference <span className="font-mono font-semibold text-ink" data-testid="student-ref">{s.referenceNo}</span>
            </p>
            <p className="mt-1 text-sm text-muted-ink">
              {s.className} · Section {s.section} · Roll {s.rollNo}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex print:hidden">
              <Button variant="outline" className="h-11" onClick={() => setEditOpen(true)}>
                <Pencil aria-hidden /> Edit
              </Button>
              {s.isArchived ? (
                <Button variant="outline" className="h-11" onClick={() => void restore(s)}>
                  <ArchiveRestore className="text-emerald-700" aria-hidden /> Restore
                </Button>
              ) : (
                <Button variant="outline" className="h-11" onClick={() => setArchiveOpen(true)}>
                  <Archive className="text-destructive" aria-hidden /> Archive
                </Button>
              )}
            </div>
          </div>
        </div>
        {s.isArchived && (
          <p role="status" className="border-t bg-gold-100 px-4 py-3 text-sm text-navy-900 sm:px-6">
            This student was archived{s.archivedAt ? ` on ${formatDate(s.archivedAt)}` : ''}. The record is kept but hidden from the default active list. Use <strong>Restore</strong> to make it active again.
          </p>
        )}
      </AdminCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Group title="Student information">
          <Field label="Full name">{s.name}</Field>
          <Field label="Date of birth">{formatDate(s.dob)}</Field>
          <Field label="Class">{s.className}</Field>
          <Field label="Section">{s.section}</Field>
          <Field label="Roll number">{s.rollNo}</Field>
          <Field label="Admission number">{s.admissionNo}</Field>
        </Group>

        <Group title="Parents and contact">
          <Field label="Father's name">{s.fatherName}</Field>
          <Field label="Mother's name">{s.motherName}</Field>
          <Field label="Mobile number">
            <a href={`tel:+91${s.mobile}`} className="hover:underline">{s.mobile}</a>
          </Field>
          <Field label="Address">{s.address}</Field>
        </Group>

        <Group title="Additional details">
          <Field label="Blood group">{s.bloodGroup ?? NOT_PROVIDED}</Field>
          <Field label="House name">{s.houseName ?? NOT_PROVIDED}</Field>
          <Field label="House colour">{s.houseColour ?? NOT_PROVIDED}</Field>
          <Field label="Bus route">{s.busRoute ?? NOT_PROVIDED}</Field>
          <Field label="Bus stoppage">{s.busStoppage ?? NOT_PROVIDED}</Field>
        </Group>

        <AdminCard title="School" className="print:shadow-none">
          <div className="space-y-3 p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-royal-50 text-royal-600">
                <Building2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="break-words font-semibold text-navy-900" data-testid="student-school">{s.schoolName}</p>
                <p className="text-sm text-muted-ink">
                  Code <span className="font-mono">{s.schoolCode}</span>
                </p>
              </div>
              <span className="ml-auto"><ActiveBadge active={s.schoolActive} /></span>
            </div>
            {!s.schoolActive && (
              <p className="rounded-xl bg-gold-100 px-3 py-2 text-xs text-navy-900">
                This school is inactive, so it no longer accepts new submissions. This student’s record is unaffected.
              </p>
            )}
            <Button asChild variant="outline" className="h-11 print:hidden">
              <Link to={`/admin/schools/${s.schoolId}`}>View school</Link>
            </Button>
          </div>
        </AdminCard>

        <Group title="Record history" cols="sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
          <Field label="Submitted">{formatDateTime(s.submittedAt)}</Field>
          <Field label="Last updated">{formatDateTime(s.updatedAt)}</Field>
          <Field label="Archived">{s.archivedAt ? formatDateTime(s.archivedAt) : <span className="font-normal text-muted-ink">No</span>}</Field>
        </Group>

        <AdminCard title={`Orders for ${s.schoolName}`} className="print:shadow-none xl:col-span-2">
          <p className="border-b bg-surface px-4 py-2.5 text-xs text-muted-ink sm:px-6">
            Orders are placed per school, not per student, so this shows the school’s orders for context. Archiving a student never changes them.
          </p>
          {schoolOrders.length === 0 ? (
            <p className="p-6 text-sm text-muted-ink">This school has no orders yet.</p>
          ) : (
            <DataTable caption="School orders" columns={orderColumns} rows={schoolOrders} rowKey={(o) => o.id} />
          )}
        </AdminCard>
      </div>

      <StudentEditDialog student={editOpen ? s : null} onClose={() => setEditOpen(false)} />
      <StudentArchiveDialog student={archiveOpen ? s : null} onClose={() => setArchiveOpen(false)} />
    </>
  )
}
