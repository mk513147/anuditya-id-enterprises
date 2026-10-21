import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, CheckCircle2, Info, Loader2, RotateCcw, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ImageDropzone, ImageQueueList } from '@/features/schools/components/ImageQueue'
import { useImageQueue, type QueueRow } from '@/features/schools/useImageQueue'
import { submitSchoolImage } from '@/features/schools/hooks'
import { runBatch } from '@/features/schools/imageBatch'
import { waMessages } from '@/lib/whatsapp'
import { isRepositoryError } from '@/services/errors'
import { CONTACT_PERSON_MAX } from '@/validations/fileSubmission'
import { IMAGE_NOTE_MAX, schoolImageSubmissionSchema, type SchoolImageSubmissionValues } from '@/validations/schoolImage'
import { SchoolSelect } from './SchoolSelect'

const inputCls = 'h-11 text-base'
type Outcome = { name: string; status: QueueRow['status']; message?: string }

/** Per-file summary shown after a fully successful batch (the form itself is cleared). */
export function ImageSubmissionSuccess({ outcomes, onReset }: { outcomes: Outcome[]; onReset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])
  const submitted = outcomes.filter((o) => o.status === 'done').length
  const present = outcomes.filter((o) => o.status === 'duplicate').length
  const rejected = outcomes.filter((o) => o.status === 'invalid').length
  return (
    <div role="status" className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
      <h2 ref={headingRef} tabIndex={-1} className="flex items-start gap-2 text-xl font-extrabold text-navy-900 outline-none">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
        {submitted ? 'Images submitted for review' : 'Nothing new to submit'}
      </h2>
      <p className="mt-1 text-sm text-ink">
        {[submitted && `${submitted} image${submitted === 1 ? '' : 's'} submitted for administrator review`, present && `${present} already present for this school`, rejected && `${rejected} not accepted`]
          .filter(Boolean)
          .join(' · ')}
        .
      </p>
      {submitted > 0 && <p className="mt-1 text-sm text-muted-ink">The administrator reviews every image before it is used and may contact you about this submission.</p>}
      <ul className="mt-4 divide-y rounded-xl border text-sm" aria-label="Result for each image">
        {outcomes.map((o, i) => (
          <li key={`${o.name}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2">
            <span className="min-w-0 truncate font-medium text-navy-900 [overflow-wrap:anywhere]" title={o.name}>{o.name}</span>
            <span className={o.status === 'invalid' ? 'text-destructive' : o.status === 'duplicate' ? 'text-gold-700' : 'text-emerald-700'}>
              {o.status === 'done' ? 'Submitted' : o.status === 'duplicate' ? 'Already present' : `Not accepted${o.message ? `: ${o.message}` : ''}`}
            </span>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" className="mt-4 h-11" onClick={onReset}>
        <RotateCcw aria-hidden /> Submit more images
      </Button>
    </div>
  )
}

/**
 * "Submit School Images" (public). Uses the same queue, checks, batch runner, bucket and duplicate rule as the
 * administrator's uploader; each image is stored as a pending submission until the administrator approves it.
 * The form is cleared only when no image failed; failed images stay in the list and can be retried.
 */
export function SchoolImageSubmissionForm() {
  const inFlight = useRef(false) // synchronous guard: React state is stale between two rapid clicks
  const abort = useRef<AbortController | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const [running, setRunning] = useState(false)
  const [imagesError, setImagesError] = useState<string | null>(null)
  const [batchAlert, setBatchAlert] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[] | null>(null)
  const q = useImageQueue({ locked: running })

  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<SchoolImageSubmissionValues>({
    resolver: zodResolver(schoolImageSubmissionSchema),
    mode: 'onTouched',
    defaultValues: { schoolId: '', contactPerson: '', contactDetails: '', note: '' },
  })

  useEffect(() => {
    if (batchAlert) alertRef.current?.focus()
  }, [batchAlert])

  const sendable = q.count('ready') + q.count('failed')
  const checkImages = () => {
    const problem = sendable > 0 ? null : q.queue.length ? 'None of the chosen images can be sent. Remove them and choose JPEG, PNG or WebP images.' : 'Please choose at least one image.'
    setImagesError(problem)
    return problem === null
  }

  const finish = (rows: Outcome[]) => {
    setOutcomes(rows)
    setBatchAlert(null)
    q.clearAll()
    reset()
    setImagesError(null)
  }
  // Everything sendable is already submitted (for example the failed images were removed instead of retried).
  const allSent = sendable === 0 && q.count('done') > 0

  const onValid = async (v: SchoolImageSubmissionValues) => {
    if (inFlight.current) return // a second click while the batch runs does nothing
    if (allSent) return finish(q.queue.map((i) => ({ name: i.file.name, status: i.status, message: i.message })))
    if (!checkImages()) return
    inFlight.current = true
    setBatchAlert(null)
    setRunning(true)
    const ctrl = new AbortController()
    abort.current = ctrl
    let unavailable = false
    // Track outcomes locally as well: the queue state is only visible on the next render.
    const status = new Map(q.queue.map((i) => [i.key, { status: i.status, message: i.message }]))
    try {
      const input = { schoolId: v.schoolId, contactPerson: v.contactPerson, contactDetails: v.contactDetails, note: v.note?.trim() || undefined }
      await runBatch(
        q.queue,
        async (file) => {
          if (unavailable) throw new Error('skipped')
          try {
            return await submitSchoolImage(input, file)
          } catch (e) {
            if (isRepositoryError(e, 'school_unavailable')) {
              unavailable = true
              ctrl.abort()
            }
            throw e
          }
        },
        {
          signal: ctrl.signal,
          onUpdate: (key, patch) => {
            status.set(key, { status: patch.status ?? status.get(key)!.status, message: patch.message })
            q.update(key, patch)
          },
        },
      )
      if (unavailable) {
        setError('schoolId', { message: 'This school is not accepting submissions at the moment. Please contact us.' }, { shouldFocus: true })
        setBatchAlert('Your images were not submitted.')
        return
      }
      const rows = q.queue.map((i) => ({ name: i.file.name, ...status.get(i.key)! }))
      const failed = rows.filter((r) => r.status === 'failed' || r.status === 'ready' || r.status === 'uploading').length
      if (failed) {
        setBatchAlert(`${failed} image${failed === 1 ? ' was' : 's were'} not submitted. They are still in the list: press “Retry” to send only those.`)
        return
      }
      finish(rows)
    } finally {
      setRunning(false)
      abort.current = null
      inFlight.current = false
    }
  }

  // Invalid text fields: report a missing image at the same time, so every problem shows at once.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => void handleSubmit(onValid, () => void checkImages())(e)

  if (outcomes) return <ImageSubmissionSuccess outcomes={outcomes} onReset={() => setOutcomes(null)} />

  const retryOnly = q.count('failed') > 0 && q.count('ready') === 0
  return (
    <form onSubmit={onSubmit} noValidate aria-busy={running} className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6" aria-labelledby="si-title">
      <h2 id="si-title" className="text-xl font-extrabold text-navy-900">Submit School Images</h2>
      <p className="mt-1 text-sm text-muted-ink">
        Send photos of your school (building, campus, events or logo artwork). Images are checked by AnudityaID’s administrator before they are used. Fields marked * are required.
      </p>

      <fieldset disabled={running} className="mt-5 grid gap-x-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SchoolSelect id="si-school" error={errors.schoolId?.message} field={register('schoolId')} hint="Choose the school these images are for." />
        </div>
        <FormField id="si-person" label="Contact person" required hint="The person submitting these images" error={errors.contactPerson?.message}>
          {(c) => <Input {...c} {...register('contactPerson')} autoComplete="name" maxLength={CONTACT_PERSON_MAX} className={inputCls} />}
        </FormField>
        <FormField id="si-contact" label="Contact details" required hint="An email address or a 10-digit mobile number" error={errors.contactDetails?.message}>
          {(c) => <Input {...c} {...register('contactDetails')} autoComplete="email" inputMode="email" maxLength={120} className={inputCls} />}
        </FormField>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-[15px] font-medium leading-snug" id="si-images-label">
            Images<span aria-hidden className="text-destructive"> *</span>
            <span className="sr-only"> (required)</span>
          </p>
          <ImageDropzone
            id="si-images"
            onFiles={(f) => {
              q.add(f)
              setImagesError(null)
            }}
            disabled={running}
            hasFiles={q.queue.length > 0}
            invalid={!!imagesError}
            describedBy={imagesError ? 'si-images-error' : 'si-images-label'}
          />
          <p id="si-images-error" role={imagesError ? 'alert' : undefined} className="min-h-5 pt-1.5 text-sm font-medium text-destructive">
            {imagesError ?? ''}
          </p>
          {q.queue.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-ink" aria-live="polite">
                {q.queue.length} chosen · {sendable} to send{q.count('invalid') ? ` · ${q.count('invalid')} not accepted` : ''}
                {q.count('done') ? ` · ${q.count('done')} submitted` : ''}
              </p>
              <ImageQueueList queue={q.queue} onRemove={q.remove} locked={running} label="Images to submit" />
            </div>
          )}
        </div>

        <div className="sm:col-span-2 mt-3">
          <FormField id="si-note" label="Note or description" hint="Optional: what the images show or how you would like them used." error={errors.note?.message}>
            {(c) => <Textarea {...c} {...register('note')} rows={2} maxLength={IMAGE_NOTE_MAX} className="min-h-20 text-base" />}
          </FormField>
        </div>
      </fieldset>

      <p className="mt-2 flex items-start gap-2 rounded-xl bg-royal-50 px-4 py-3 text-sm text-navy-900">
        <Info className="mt-0.5 size-4 shrink-0 text-royal-600" aria-hidden />
        Your images and contact details will be reviewed by AnudityaID's administrator, who may contact you about this submission.
      </p>

      {batchAlert && !running && (
        <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-red-50 p-4 sm:p-5">
          <div ref={alertRef} tabIndex={-1} className="flex items-start gap-2 font-semibold text-destructive outline-none">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            {batchAlert}
          </div>
          <p className="mt-1 text-sm text-ink">Your details are still here. If the problem continues, message us on WhatsApp.</p>
          <div className="mt-3">
            <WhatsAppButton size="lg" label="WhatsApp Us" message={waMessages.fileUploadHelp()} />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" size="lg" className="h-12 w-full sm:w-auto" disabled={running}>
          {running ? <Loader2 className="animate-spin" aria-hidden /> : retryOnly ? <RotateCcw aria-hidden /> : allSent ? <CheckCircle2 aria-hidden /> : <Send aria-hidden />}
          {running ? 'Submitting images…' : retryOnly ? `Retry ${q.count('failed')} failed` : allSent ? 'Finish' : 'Submit Images'}
        </Button>
        {running && (
          <Button type="button" variant="outline" size="lg" className="h-12 w-full sm:w-auto" onClick={() => abort.current?.abort()}>
            Stop after current uploads
          </Button>
        )}
      </div>
    </form>
  )
}
