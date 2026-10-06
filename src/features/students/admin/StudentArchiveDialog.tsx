import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import type { Student } from '@/types'
import { useSetStudentArchived } from '../hooks'

/** Confirms archiving a student. `student` null = closed. Restoring is non-destructive and needs no dialog. */
export function StudentArchiveDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  const archive = useSetStudentArchived()

  const confirm = async () => {
    if (!student) return
    try {
      await archive.mutateAsync({ id: student.id, archived: true })
      toast.success('Student archived', { description: `${student.name} (${student.referenceNo})` })
      onClose()
    } catch {
      toast.error('Could not archive the student. Please try again.')
    }
  }

  return (
    <ConfirmDialog
      open={!!student}
      onOpenChange={(o) => !o && onClose()}
      title={`Archive ${student?.name}?`}
      description={
        <>
          <p>
            <strong>{student?.name}</strong> ({student?.referenceNo}) will no longer appear in the default active-student list.
          </p>
          <p className="mt-2">
            Nothing is deleted: the record, reference number and school are kept, orders are not affected, and you can restore the student at any time using the <strong>Archived</strong> filter.
          </p>
        </>
      }
      confirmLabel="Archive student"
      destructive
      loading={archive.isPending}
      onConfirm={() => void confirm()}
    />
  )
}
