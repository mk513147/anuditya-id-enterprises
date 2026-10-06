import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isRepositoryError } from '@/services/errors'
import type { AdminStudent } from '@/services/types'
import { studentEditSchema, toStudentFields, type StudentEditFormValues } from '@/validations/student'
import { StudentCoreFields, type StudentSectionProps } from '../components/StudentCoreFields'
import { useUpdateStudent } from '../hooks'

function PlainSection({ title, children }: StudentSectionProps): ReactNode {
  return (
    <section className="mb-2" aria-label={title}>
      <h3 className="mb-3 border-b pb-2 text-base font-bold">{title}</h3>
      {children}
    </section>
  )
}

function EditForm({ student, onClose }: { student: AdminStudent; onClose: () => void }) {
  const update = useUpdateStudent()
  const {
    register, handleSubmit, setError,
    formState: { errors, isSubmitting },
  } = useForm<StudentEditFormValues>({
    resolver: zodResolver(studentEditSchema),
    mode: 'onTouched',
    defaultValues: {
      name: student.name, fatherName: student.fatherName, motherName: student.motherName, dob: student.dob,
      className: student.className, section: student.section, rollNo: student.rollNo, admissionNo: student.admissionNo,
      address: student.address, mobile: student.mobile,
      bloodGroup: student.bloodGroup ?? '', houseName: student.houseName ?? '', houseColour: student.houseColour ?? '',
      busRoute: student.busRoute ?? '', busStoppage: student.busStoppage ?? '',
    },
  })
  const busy = isSubmitting || update.isPending

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ id: student.id, input: toStudentFields(v) })
      toast.success('Student updated', { description: `${v.name} (${student.referenceNo})` })
      onClose()
    } catch (e) {
      // The repository leaves the record untouched on failure, and the form keeps everything the admin typed.
      if (isRepositoryError(e, 'duplicate_admission_no')) {
        setError('admissionNo', { message: 'Another student in this school already has this admission number.' }, { shouldFocus: true })
      } else if (isRepositoryError(e, 'not_found')) {
        toast.error('This student no longer exists.')
        onClose()
      } else {
        toast.error('Could not save the changes. Nothing was changed, please try again.')
      }
    }
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit student</DialogTitle>
        <DialogDescription>
          Reference <span className="font-mono font-semibold text-ink">{student.referenceNo}</span> · {student.schoolName}. The reference number and school cannot be changed here. Fields marked * are required.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} noValidate aria-busy={busy}>
        <StudentCoreFields register={register} errors={errors} Section={PlainSection} />
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Save changes
          </Button>
        </div>
      </form>
    </>
  )
}

/** `student` null = closed. The form is mounted only while open, so each open starts from the saved record. */
export function StudentEditDialog({ student, onClose }: { student: AdminStudent | null; onClose: () => void }) {
  return (
    <Dialog open={!!student} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        {student && <EditForm key={student.id} student={student} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
