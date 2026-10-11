import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, Info, Loader2, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useForm, type UseFormRegisterReturn } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useActiveSchools } from '@/features/schools/hooks'
import { waMessages } from '@/lib/whatsapp'
import { describeError, isRepositoryError } from '@/services/errors'
import { FILE_CATEGORIES, FILE_CATEGORY_LABEL, type FileUploadResult } from '@/types'
import {
  CONTACT_PERSON_MAX, DESCRIPTION_MAX, INSTRUCTIONS_MAX, schoolFileFieldsSchema, type SchoolFileFormValues,
} from '@/validations/fileSubmission'
import { FILE_INPUT_ACCEPT, sniffSpreadsheet, validateUploadFile } from '@/validations/upload'
import { useSubmitSchoolFile } from '../hooks'
import { FileDropzone } from './FileDropzone'
import { SelectedFileCard } from './SelectedFileCard'
import { UploadProgress } from './UploadProgress'

const FIELD_KEYS = ['schoolId', 'contactPerson', 'contactDetails', 'category', 'description', 'instructions'] as const
const inputCls = 'h-11 text-base'

function SchoolSelect({ error, field }: { error?: string; field: UseFormRegisterReturn }) {
  const { data: schools, isPending, isError, refetch } = useActiveSchools()
  const noSchools = !isPending && !isError && schools.length === 0
  return (
    <div>
      <FormField
        id="sd-school"
        label="School name"
        required
        hint={noSchools || isError ? undefined : 'Choose the school this file is for.'}
        error={error ?? (isError ? 'Could not load the school list.' : undefined)}
      >
        {(c) => (
          <NativeSelect {...c} {...field} disabled={isPending || isError || noSchools}>
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
        <Button type="button" variant="outline" size="sm" className="-mt-1 mb-2 h-10" onClick={() => void refetch()}>
          Try loading again
        </Button>
      )}
      {noSchools && <p className="-mt-1 mb-2 text-sm text-ink">No schools are accepting files right now. Please contact us on WhatsApp.</p>}
    </div>
  )
}

/**
 * "Submit School Data File". Every field is validated here, again in the repository, and again by the database.
 * Nothing is uploaded until the whole form is valid; success is shown only when the file is stored AND registered.
 */
export function SchoolFileSubmissionForm({ onSubmitted }: { onSubmitted: (result: FileUploadResult) => void }) {
  const sub = useSubmitSchoolFile()
  const inputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const inFlight = useRef(false) // synchronous guard: React state is stale between two rapid clicks
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const {
    register, handleSubmit, setError,
    formState: { errors },
  } = useForm<SchoolFileFormValues>({
    resolver: zodResolver(schoolFileFieldsSchema),
    mode: 'onTouched',
    defaultValues: { schoolId: '', contactPerson: '', contactDetails: '', category: '' as never, description: '', instructions: '' },
  })

  useEffect(() => {
    if (sub.isPending) progressRef.current?.focus()
  }, [sub.isPending])
  useEffect(() => {
    if (sub.isError) errorRef.current?.focus()
  }, [sub.isError])

  const busy = sub.isPending || checking
  const openPicker = () => inputRef.current?.click()

  /** One entry point for the picker and drag-and-drop. An invalid file is never kept. */
  const choose = async (f: File | undefined) => {
    if (inputRef.current) inputRef.current.value = '' // lets the same file be chosen again later
    const problem = validateUploadFile(f) ?? (f ? await sniffSpreadsheet(f) : null)
    if (problem || !f) {
      setFileError(problem)
      return
    }
    setFileError(null)
    setFile(f)
    sub.reset()
  }

  const remove = () => {
    setFile(null)
    setFileError(null)
    sub.reset()
  }

  const checkFile = async () => {
    const problem = validateUploadFile(file) ?? (file ? await sniffSpreadsheet(file) : null)
    setFileError(problem)
    return problem === null
  }

  const onValid = async (v: SchoolFileFormValues) => {
    if (inFlight.current) return // a second click while the first submission runs does nothing
    inFlight.current = true
    setChecking(true)
    try {
      if (!(await checkFile()) || !file) return
      setChecking(false)
      const result = await sub.submit({
        schoolId: v.schoolId,
        contactPerson: v.contactPerson,
        contactDetails: v.contactDetails,
        category: v.category,
        description: v.description,
        instructions: v.instructions || undefined,
        file,
      })
      onSubmitted(result)
    } catch (e) {
      // Field problems found by the repository or the database go back to their fields; the rest shows as an alert.
      if (isRepositoryError(e, 'invalid_input') && e.fieldErrors) {
        for (const [k, message] of Object.entries(e.fieldErrors)) {
          if (k === 'file') setFileError(message)
          else if ((FIELD_KEYS as readonly string[]).includes(k)) setError(k as (typeof FIELD_KEYS)[number], { message })
        }
      } else if (isRepositoryError(e, 'school_unavailable')) {
        setError('schoolId', { message: 'This school is not accepting files at the moment. Please contact us.' }, { shouldFocus: true })
      }
    } finally {
      setChecking(false)
      inFlight.current = false
    }
  }

  // Invalid text fields: still report a missing or invalid file at the same time, so every problem shows at once.
  // (Built inside the event handler, so the ref-reading submit logic is never touched during render.)
  const onSubmit = (e: FormEvent<HTMLFormElement>) => void handleSubmit(onValid, () => void checkFile())(e)

  const fieldAlert = isRepositoryError(sub.error, 'invalid_input') || isRepositoryError(sub.error, 'school_unavailable')

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy} className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
      <h2 className="text-xl font-extrabold text-navy-900">Submit School Data File</h2>
      <p className="mt-1 text-sm text-muted-ink">Fields marked * are required.</p>

      <fieldset disabled={sub.isPending} className="mt-5 grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SchoolSelect error={errors.schoolId?.message} field={register('schoolId')} />
        </div>
        <FormField id="sd-person" label="Contact person" required hint="The person submitting this file" error={errors.contactPerson?.message}>
          {(c) => <Input {...c} {...register('contactPerson')} autoComplete="name" maxLength={CONTACT_PERSON_MAX} className={inputCls} />}
        </FormField>
        <FormField id="sd-contact" label="Contact details" required hint="An email address or a 10-digit mobile number" error={errors.contactDetails?.message}>
          {(c) => <Input {...c} {...register('contactDetails')} autoComplete="email" inputMode="email" maxLength={120} className={inputCls} />}
        </FormField>
        <div className="sm:col-span-2">
          <FormField id="sd-category" label="File category" required error={errors.category?.message}>
            {(c) => (
              <NativeSelect {...c} {...register('category')}>
                <option value="" disabled>
                  Select what the file is for
                </option>
                {FILE_CATEGORIES.map((k) => (
                  <option key={k} value={k}>
                    {FILE_CATEGORY_LABEL[k]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField
            id="sd-description"
            label="File description"
            required
            hint="Say what the file contains, the academic session and class or section if applicable, and what work you need."
            error={errors.description?.message}
          >
            {(c) => (
              <Textarea
                {...c}
                {...register('description')}
                rows={3}
                maxLength={DESCRIPTION_MAX}
                placeholder="Student list for the 2026–27 session, Class 10, for ID card printing."
                className="min-h-24 text-base"
              />
            )}
          </FormField>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[15px] font-medium leading-snug" id="sd-file-label">
            File<span aria-hidden className="text-destructive"> *</span>
            <span className="sr-only"> (required)</span>
          </p>
          <input
            ref={inputRef}
            id="sd-file"
            type="file"
            accept={FILE_INPUT_ACCEPT}
            aria-labelledby="sd-file-label"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => void choose(e.target.files?.[0])}
          />
          {file ? (
            <SelectedFileCard file={file} mode={busy ? 'busy' : 'form'} onRemove={remove} onReplace={openPicker} />
          ) : (
            <FileDropzone onBrowse={openPicker} onDropFile={(f) => void choose(f)} invalid={!!fileError} describedBy={fileError ? 'sd-file-error' : undefined} />
          )}
          <p id="sd-file-error" role={fileError ? 'alert' : undefined} className="min-h-5 pt-1.5 text-sm font-medium text-destructive">
            {fileError ?? ''}
          </p>
        </div>

        <div className="sm:col-span-2">
          <FormField id="sd-instructions" label="Additional instructions" hint="Optional: deadlines, formatting requirements or anything else we should know." error={errors.instructions?.message}>
            {(c) => <Textarea {...c} {...register('instructions')} rows={2} maxLength={INSTRUCTIONS_MAX} className="min-h-20 text-base" />}
          </FormField>
        </div>
      </fieldset>

      <p className="mt-2 flex items-start gap-2 rounded-xl bg-royal-50 px-4 py-3 text-sm text-navy-900">
        <Info className="mt-0.5 size-4 shrink-0 text-royal-600" aria-hidden />
        Your file and contact details will be reviewed by AnudityaID's administrator, who may contact you about this submission.
      </p>

      {sub.isPending && <UploadProgress ref={progressRef} percent={sub.progress} />}

      {sub.isError && !sub.isPending && (
        <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-red-50 p-4 sm:p-5">
          <p ref={errorRef} tabIndex={-1} className="flex items-start gap-2 font-semibold text-destructive outline-none">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            {fieldAlert ? 'Please check the highlighted fields.' : 'Your file was not submitted.'}
          </p>
          {!fieldAlert && (
            <>
              <p className="mt-1 text-sm text-ink">{describeError(sub.error, 'Something went wrong. Your details are still here; please try again.')}</p>
              <div className="mt-3">
                <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.fileUploadHelp()} />
              </div>
            </>
          )}
        </div>
      )}

      <Button type="submit" size="lg" disabled={busy} className="mt-5 w-full sm:w-auto sm:min-w-52">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {sub.isPending ? 'Submitting…' : checking ? 'Checking file…' : 'Submit File'}
      </Button>
    </form>
  )
}
