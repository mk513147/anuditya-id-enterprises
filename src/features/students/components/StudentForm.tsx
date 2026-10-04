import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Loader2, Send } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { FormSection } from '@/components/shared/FormSection'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { waMessages } from '@/lib/whatsapp'
import type { StudentSubmissionResult } from '@/types'
import { CLASS_OPTIONS, normalizeMobile, studentSchema, todayISO, type StudentFormValues } from '@/validations/student'
import { useSubmitStudent } from '../hooks'
import { StudentPhotoUpload } from './StudentPhotoUpload'

const TODAY = todayISO()
const inputCls = 'h-11 text-base'
const GRID = 'grid gap-x-4 sm:grid-cols-2'

export function StudentForm({ onSubmitted }: { onSubmitted: (result: StudentSubmissionResult) => void }) {
  const submit = useSubmitStudent()
  const {
    register, control, handleSubmit, trigger,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    mode: 'onTouched',
    defaultValues: { name: '', fatherName: '', motherName: '', dob: '', className: '', section: '', rollNo: '', admissionNo: '', address: '', mobile: '' },
  })

  const onSubmit = handleSubmit(async (v) => {
    try {
      const result = await submit.mutateAsync({
        name: v.name,
        fatherName: v.fatherName,
        motherName: v.motherName,
        dob: v.dob,
        className: v.className,
        section: v.section.toUpperCase(),
        rollNo: v.rollNo,
        admissionNo: v.admissionNo,
        address: v.address,
        mobile: normalizeMobile(v.mobile),
        photo: v.photo,
      })
      onSubmitted(result)
    } catch {
      // Surfaced via submit.isError below; the entered data stays in the form so the user can retry.
    }
  })

  const errorCount = Object.keys(errors).length
  const busy = isSubmitting || submit.isPending

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="space-y-5">
      <p className="text-sm text-muted-ink">
        Fields marked <span className="font-bold text-destructive">*</span> are required.
      </p>

      <FormSection step={1} icon="user" title="Student Information">
        <div className={GRID}>
          <div className="sm:col-span-2">
            <FormField id="sf-name" label="Student Name" required error={errors.name?.message}>
              {(c) => <Input {...c} autoComplete="off" autoCapitalize="words" maxLength={60} placeholder="As per school records" className={inputCls} {...register('name')} />}
            </FormField>
          </div>
          <FormField id="sf-dob" label="Date of Birth" required error={errors.dob?.message}>
            {(c) => <Input {...c} type="date" max={TODAY} min="1980-01-01" className={`${inputCls} block`} {...register('dob')} />}
          </FormField>
          <FormField id="sf-class" label="Class" required error={errors.className?.message}>
            {(c) => (
              <NativeSelect {...c} {...register('className')} defaultValue="">
                <option value="" disabled>Select class</option>
                {CLASS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="sf-section" label="Section" required hint="For example: A, B or C" error={errors.section?.message}>
            {(c) => <Input {...c} autoComplete="off" autoCapitalize="characters" maxLength={5} placeholder="A" className={inputCls} {...register('section')} />}
          </FormField>
          <FormField id="sf-roll" label="Roll Number" required error={errors.rollNo?.message}>
            {(c) => <Input {...c} autoComplete="off" maxLength={10} placeholder="e.g. 23" className={inputCls} {...register('rollNo')} />}
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="sf-adm" label="Admission Number" required error={errors.admissionNo?.message}>
              {(c) => <Input {...c} autoComplete="off" maxLength={20} placeholder="e.g. 2024/0123" className={inputCls} {...register('admissionNo')} />}
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection step={2} icon="users" title="Parent Information">
        <div className={GRID}>
          <FormField id="sf-father" label="Father Name" required error={errors.fatherName?.message}>
            {(c) => <Input {...c} autoComplete="off" autoCapitalize="words" maxLength={60} className={inputCls} {...register('fatherName')} />}
          </FormField>
          <FormField id="sf-mother" label="Mother Name" required error={errors.motherName?.message}>
            {(c) => <Input {...c} autoComplete="off" autoCapitalize="words" maxLength={60} className={inputCls} {...register('motherName')} />}
          </FormField>
        </div>
      </FormSection>

      <FormSection step={3} icon="phone" title="Contact Information">
        <div className="grid gap-x-4">
          <div className="sm:max-w-xs">
            <FormField id="sf-mobile" label="Mobile Number" required hint="10-digit Indian mobile number" error={errors.mobile?.message}>
              {(c) => <Input {...c} type="tel" inputMode="tel" autoComplete="off" maxLength={17} placeholder="98765 43210" className={inputCls} {...register('mobile')} />}
            </FormField>
          </div>
          <FormField id="sf-address" label="Address" required error={errors.address?.message}>
            {(c) => <Textarea {...c} rows={3} maxLength={250} autoComplete="off" placeholder="House / street, village or town, district, PIN code" className="min-h-24 text-base" {...register('address')} />}
          </FormField>
        </div>
      </FormSection>

      <FormSection step={4} icon="camera" title="Student Photo">
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
            Something went wrong while submitting your form.
          </p>
          <p className="mt-1 text-sm text-ink">Your details are still filled in. Please try again, or contact us on WhatsApp.</p>
          <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
            <Button type="button" variant="destructive" className="h-11" onClick={() => void onSubmit()}>
              Try Again
            </Button>
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
