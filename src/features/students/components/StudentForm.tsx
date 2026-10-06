import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Building2, Loader2, Send } from 'lucide-react'
import { Controller, useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { FormSection } from '@/components/shared/FormSection'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { useActiveSchools } from '@/features/schools/hooks'
import { waMessages } from '@/lib/whatsapp'
import { isRepositoryError } from '@/services/errors'
import type { School, StudentSubmissionResult } from '@/types'
import { studentSchema, toStudentFields, type StudentFormValues } from '@/validations/student'
import { useSubmitStudent } from '../hooks'
import { StudentCoreFields } from './StudentCoreFields'
import { StudentPhotoUpload } from './StudentPhotoUpload'

interface Props {
  /**
   * School-specific mode (/school/:slug): the school is fixed and no selector is shown.
   * When omitted (/student-form) the user must choose an active school from a dropdown.
   * Either way the repository re-validates the school; the UI is never the authority.
   */
  school?: Pick<School, 'id' | 'name'>
  onSubmitted: (result: StudentSubmissionResult) => void
}

function SchoolSelect({ error, field }: { error?: string; field: UseFormRegisterReturn }) {
  const { data: schools, isPending, isError, refetch } = useActiveSchools()
  const noSchools = !isPending && !isError && schools.length === 0
  return (
    <div className="sm:col-span-2">
      <FormField
        id="sf-school"
        label="School"
        required
        hint={noSchools ? undefined : 'Select the school the student belongs to.'}
        error={error ?? (isError ? 'Could not load the school list.' : undefined)}
      >
        {(c) => (
          <NativeSelect {...c} {...field} defaultValue="" disabled={isPending || isError || noSchools}>
            <option value="" disabled>
              {isPending ? 'Loading schools…' : noSchools ? 'No schools available' : 'Select school'}
            </option>
            {schools?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {isError && (
        <Button type="button" variant="outline" size="sm" className="-mt-1 h-10" onClick={() => void refetch()}>
          Try loading again
        </Button>
      )}
      {noSchools && <p className="-mt-1 text-sm text-ink">No schools are currently accepting submissions. Please contact us on WhatsApp.</p>}
    </div>
  )
}

export function StudentForm({ school, onSubmitted }: Props) {
  const submit = useSubmitStudent()
  const {
    register, control, handleSubmit, trigger,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    mode: 'onTouched',
    defaultValues: {
      schoolId: school?.id ?? '',
      name: '', fatherName: '', motherName: '', dob: '', className: '', section: '', rollNo: '', admissionNo: '', address: '', mobile: '',
      bloodGroup: '', houseName: '', houseColour: '', busRoute: '', busStoppage: '',
    },
  })

  const onSubmit = handleSubmit(async (v) => {
    try {
      const result = await submit.mutateAsync({ schoolId: v.schoolId, ...toStudentFields(v), photo: v.photo })
      onSubmitted(result)
    } catch {
      // Surfaced via submit.isError below; the entered data stays in the form so the user can retry.
    }
  })

  const errorCount = Object.keys(errors).length
  const busy = isSubmitting || submit.isPending
  const schoolGone = isRepositoryError(submit.error, 'school_unavailable')

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-5">
      <p className="text-sm text-muted-ink">
        Fields marked <span className="font-bold text-destructive">*</span> are required.
      </p>

      <StudentCoreFields
        register={register}
        errors={errors}
        Section={FormSection}
        studentInfoPrefix={
          school ? (
            <p className="mb-3 flex items-center gap-2 rounded-xl bg-royal-50 px-3 py-2.5 text-sm text-ink sm:col-span-2" data-testid="fixed-school">
              <Building2 className="size-4 shrink-0 text-royal-600" aria-hidden />
              <span>
                Submitting for <strong className="text-navy-900">{school.name}</strong>
              </span>
            </p>
          ) : (
            <SchoolSelect field={register('schoolId')} error={errors.schoolId?.message} />
          )
        }
      />

      <FormSection step={5} icon="camera" title="Student Photo">
        <Controller
          control={control}
          name="photo"
          render={({ field }) => (
            <FormField id="sf-photo" label="Student Photo" required hint="Use a clear, front-facing photograph with a plain background." error={errors.photo?.message}>
              {(c) => (
                <StudentPhotoUpload
                  id={c.id}
                  ref={field.ref}
                  value={field.value}
                  onChange={(file) => {
                    field.onChange(file)
                    void trigger('photo') // validate immediately so a bad file is flagged on selection
                  }}
                  onBlur={field.onBlur}
                  invalid={c['aria-invalid']}
                  describedBy={c['aria-describedby']}
                />
              )}
            </FormField>
          )}
        />
      </FormSection>

      {submitCount > 0 && errorCount > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-red-50 p-3 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Please correct the {errorCount} highlighted {errorCount === 1 ? 'field' : 'fields'} before submitting.
        </p>
      )}

      {submit.isError && !busy && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-red-50 p-4">
          <p className="flex items-start gap-2 font-semibold text-destructive">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            {schoolGone ? 'This school is not accepting submissions right now.' : 'Something went wrong while submitting your form.'}
          </p>
          <p className="mt-1 text-sm text-ink">
            {schoolGone ? 'Please contact us so we can help you.' : 'Your details are still filled in. Please try again, or contact us on WhatsApp.'}
          </p>
          <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
            {!schoolGone && (
              <Button type="button" variant="destructive" className="h-11" onClick={() => void onSubmit()}>
                Try Again
              </Button>
            )}
            <WhatsAppButton className="h-11" label="WhatsApp Us" message={waMessages.general()} />
          </div>
        </div>
      )}

      <Button type="submit" size="lg" disabled={busy} className="w-full sm:w-auto sm:min-w-56">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? 'Submitting…' : 'Submit Form'}
      </Button>
    </form>
  )
}
