import { FileArchive, FileSpreadsheet, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminCard, AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Pagination } from '@/components/admin/Pagination'
import { ApprovalBadge, StatusBadge } from '@/components/admin/StatusBadge'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { useSchools } from '@/features/schools/hooks'
import { StudentArchiveDialog } from '@/features/students/admin/StudentArchiveDialog'
import { StudentEditDialog } from '@/features/students/admin/StudentEditDialog'
import { StudentFilters } from '@/features/students/admin/StudentFilters'
import { StudentRowActions } from '@/features/students/admin/StudentRowActions'
import { StudentPhotoExportDialog } from '@/features/students/admin/StudentPhotoExportDialog'
import { studentExportFilename, studentsWorkbook } from '@/features/students/admin/studentExport'
import { toListParams, useStudentFilters } from '@/features/students/admin/useStudentFilters'
import { useAdminStudents, useExportStudents, useRestoreStudent, useStudentFilterOptions } from '@/features/students/hooks'
import { usePageTitle } from '@/hooks/usePageTitle'
import { downloadBlob } from '@/lib/download'
import { formatDate } from '@/lib/format'
import { workbookBlob } from '@/lib/xlsx'
import { describeError } from '@/services/errors'
import type { AdminStudent } from '@/services/types'
import type { Student } from '@/types'

const PAGE_SIZE = 10

export function AdminStudentsPage() {
  usePageTitle('Students – Admin')
  const { filters, update, clear, hasActiveFilters } = useStudentFilters()
  const { data, isPending, isError, error, isFetching, refetch } = useAdminStudents(toListParams(filters, PAGE_SIZE))
  const { data: schools = [] } = useSchools({})
  const { data: options } = useStudentFilterOptions()
  const restore = useRestoreStudent()
  const [editing, setEditing] = useState<AdminStudent | null>(null)
  const [archiving, setArchiving] = useState<Student | null>(null)
  const exporter = useExportStudents()
  const [building, setBuilding] = useState(false)
  const [photoExportOpen, setPhotoExportOpen] = useState(false)

  /** Exports every student matching the current filters (all pages) as an Excel workbook, with an explicit column list. */
  const exportExcel = async () => {
    if (building) return
    try {
      const { rows, truncated } = await exporter.mutateAsync({ ...toListParams(filters), page: undefined, pageSize: undefined })
      if (rows.length === 0) {
        toast.info('Nothing to export', { description: 'No students match the current filters.' })
        return
      }
      setBuilding(true)
      downloadBlob(studentExportFilename(), workbookBlob(await studentsWorkbook(rows)))
      toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'student' : 'students'}`, {
        description: truncated ? 'The export limit was reached: narrow the filters to export the rest.' : 'The file is in your downloads. It contains personal data: store it securely.',
      })
    } catch (e) {
      toast.error(describeError(e, 'Could not create the Excel file. Please try again.'))
    } finally {
      setBuilding(false)
    }
  }
  const exportBusy = exporter.isPending || building

  const columns: Column<AdminStudent>[] = [
    {
      key: 'student',
      header: 'Student',
      cell: (s) => (
        <span>
          <Link to={`/admin/students/${s.id}`} className="-my-3 inline-flex min-h-11 items-center rounded font-semibold text-navy-900 hover:text-royal-600 hover:underline">
            {s.name}
          </Link>
          <span className="block font-mono text-xs font-normal text-muted-ink">{s.referenceNo}</span>
        </span>
      ),
    },
    {
      key: 'school',
      header: 'School',
      cell: (s) => (
        <span>
          {s.schoolName}
          <span className="block text-xs text-muted-ink">
            {s.schoolCode}
            {!s.schoolActive && ' · inactive school'}
          </span>
        </span>
      ),
    },
    { key: 'class', header: 'Class', cell: (s) => `${s.className} · ${s.section}` },
    {
      key: 'ids',
      header: 'Roll / Admission',
      cell: (s) => (
        <span>
          Roll {s.rollNo}
          <span className="block text-xs text-muted-ink">{s.admissionNo}</span>
        </span>
      ),
    },
    { key: 'submitted', header: 'Submitted', cell: (s) => formatDate(s.submittedAt), className: 'whitespace-nowrap' },
    { key: 'review', header: 'Review', cell: (s) => <ApprovalBadge status={s.approvalStatus} /> },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge tone={s.isArchived ? 'neutral' : 'green'}>{s.isArchived ? 'Archived' : 'Active'}</StatusBadge> },
  ]

  return (
    <>
      <AdminPageHeader
        description={
          data ? (
            <span aria-live="polite">
              <strong className="text-ink" data-testid="total-count">{data.total}</strong> {data.total === 1 ? 'student matches' : 'students match'} the current view ·{' '}
              <span data-testid="active-count">{data.counts.active}</span> active · <span data-testid="archived-count">{data.counts.archived}</span> archived ·{' '}
              <button type="button" className="font-semibold text-royal-700 underline-offset-2 hover:underline" onClick={() => update({ approval: 'pending', status: 'active' })}>
                <span data-testid="pending-count">{data.counts.pending}</span> pending review
              </button>
            </span>
          ) : (
            'Find a student, review new submissions, open the full record, edit details or archive it.'
          )
        }
        actions={
          <>
            <Button size="lg" variant="outline" onClick={() => void exportExcel()} disabled={exportBusy || !data || data.total === 0} title="All students matching the current filters, as an Excel workbook">
              {exportBusy ? <Loader2 className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />}
              Export Excel
            </Button>
            <Button size="lg" variant="outline" onClick={() => setPhotoExportOpen(true)} disabled={!data || data.total === 0} title="All students matching the current filters, with their photographs (.zip)">
              <FileArchive aria-hidden /> Export with photos
            </Button>
          </>
        }
      />

      <AdminCard>
        <StudentFilters
          filters={filters}
          update={update}
          clear={clear}
          schools={schools}
          sections={options?.sections ?? []}
          hasActiveFilters={hasActiveFilters}
        />

        {isError ? (
          <div className="p-6">
            <ErrorState message={describeError(error, 'Could not load students.')} onRetry={() => void refetch()} />
          </div>
        ) : isPending ? (
          <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading students">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        ) : data.total === 0 ? (
          <div className="p-6 sm:p-10">
            {hasActiveFilters ? (
              <EmptyState
                title="No students match these filters"
                text="Try changing or removing a filter. Archived students are hidden unless you choose them in the Status filter."
                action={
                  <Button variant="outline" onClick={clear}>
                    Clear all filters
                  </Button>
                }
              />
            ) : (
              <EmptyState title="No students yet" text="Students appear here as soon as a form is submitted from the public student form or a school link." />
            )}
          </div>
        ) : (
          <>
            <DataTable
              caption="Students"
              columns={columns}
              rows={data.items}
              rowKey={(s) => s.id}
              busy={isFetching}
              actions={(s, ctx) => <StudentRowActions student={s} context={ctx} onEdit={() => setEditing(s)} onArchive={setArchiving} onRestore={(st) => void restore(st)} />}
            />
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} noun="students" onPageChange={(page) => update({ page })} />
          </>
        )}
      </AdminCard>

      <StudentEditDialog student={editing} onClose={() => setEditing(null)} />
      <StudentArchiveDialog student={archiving} onClose={() => setArchiving(null)} />
      <StudentPhotoExportDialog open={photoExportOpen} onOpenChange={setPhotoExportOpen} params={toListParams(filters)} matching={data?.total ?? 0} />
    </>
  )
}
