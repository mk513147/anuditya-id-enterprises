import { Check, Download, FileX, Loader2, MessageSquareWarning, Save, ShieldAlert, Undo2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { FileReviewBadge } from '@/components/admin/StatusBadge'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatBytes, formatDateTime } from '@/lib/format'
import { describeError, isRepositoryError } from '@/services/errors'
import type { AdminFile, AdminFileDetail } from '@/services/types'
import { FILE_CATEGORY_LABEL, FILE_REVIEW_LABEL, type FileReviewStatus } from '@/types'
import { FILE_TYPE_LABEL } from '@/validations/upload'
import { useAdminFile, useFileDownload, useReviewFile } from '../adminHooks'
import { NO_SCHOOL } from './fileColumns'

const NOTES_MAX = 1000
const NOT_GIVEN = <span className="font-normal text-muted-ink">Not given</span>

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="text-xs font-medium text-muted-ink">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm font-semibold text-navy-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function contactLink(value: string) {
  return /^\d{10}$/.test(value) ? <a className="hover:underline" href={`tel:+91${value}`}>{value}</a> : <a className="hover:underline" href={`mailto:${value}`}>{value}</a>
}

/**
 * Presentational: exactly what the repository holds about a submission. `download` and `review` are slots for the
 * controls, so this renders (and is tested) without the data layer. A metadata-only record says there is nothing to
 * download instead of offering a button that cannot work.
 */
export function FileDetails({ file, download, review }: { file: AdminFile | AdminFileDetail; download?: ReactNode; review?: ReactNode }) {
  const history = 'reviewHistory' in file ? file.reviewHistory : []
  return (
    <div className="space-y-5">
      <section aria-labelledby="fd-submission">
        <h3 id="fd-submission" className="mb-2 text-sm font-bold text-navy-900">Submission</h3>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="School">{file.schoolName ?? <span className="font-normal text-muted-ink">{NO_SCHOOL}</span>}</Field>
          <Field label="Category">{file.category ? FILE_CATEGORY_LABEL[file.category] : NOT_GIVEN}</Field>
          <Field label="Contact person">{file.contactPerson ?? NOT_GIVEN}</Field>
          <Field label="Contact details">{file.contactDetails ? contactLink(file.contactDetails) : NOT_GIVEN}</Field>
          <Field label="Description" wide>{file.description ?? NOT_GIVEN}</Field>
          <Field label="Additional instructions" wide>{file.instructions ?? <span className="font-normal text-muted-ink">None</span>}</Field>
        </dl>
        {!file.contactPerson && <p className="mt-2 text-xs text-muted-ink">This file was uploaded before the submission form collected these details.</p>}
      </section>

      <section aria-labelledby="fd-file">
        <h3 id="fd-file" className="mb-2 text-sm font-bold text-navy-900">File</h3>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="File name">{file.originalName}</Field>
          <Field label="Reference">
            <span className="font-mono">{file.referenceNo}</span>
          </Field>
          <Field label="Format">{FILE_TYPE_LABEL[file.type]}</Field>
          <Field label="Size">
            {formatBytes(file.sizeBytes)} ({file.sizeBytes.toLocaleString('en-IN')} bytes)
          </Field>
          <Field label="Submitted">{formatDateTime(file.uploadedAt)}</Field>
        </dl>
        <div className="mt-3">
          {file.storageState === 'stored' ? (
            download
          ) : (
            <p role="note" className="rounded-lg border border-gold-400/40 bg-gold-100 px-3 py-2 text-sm text-navy-900">
              <strong>File contents are not available.</strong> Only the details of this upload were recorded, not the file itself, so it cannot be opened or
              downloaded.
            </p>
          )}
        </div>
      </section>

      {review}

      {history.length > 0 && (
        <section aria-labelledby="fd-history">
          <h3 id="fd-history" className="mb-2 text-sm font-bold text-navy-900">Review history</h3>
          <ol className="space-y-2 text-sm">
            {[...history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`} className="rounded-lg border px-3 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  <FileReviewBadge status={h.status} />
                  <span className="text-xs text-muted-ink">{formatDateTime(h.at)}</span>
                </span>
                {h.notes && <span className="mt-1 block whitespace-pre-line text-ink [overflow-wrap:anywhere]">{h.notes}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

const DECISION_COPY: Record<Exclude<FileReviewStatus, 'pending'>, { title: string; text: string; confirm: string; destructive?: boolean }> = {
  approved: { title: 'Approve this submission?', text: 'The file will be marked as approved for work to begin.', confirm: 'Approve' },
  corrections_required: { title: 'Request corrections?', text: 'The submission will be marked as needing corrections. Explain what to fix in the notes, then contact the submitter.', confirm: 'Request corrections' },
  rejected: { title: 'Reject this submission?', text: 'The submission will be marked as rejected. It is not deleted and can be reviewed again later.', confirm: 'Reject', destructive: true },
}

/** The administrator's decision and notes. The database re-checks that the caller is the administrator. */
function ReviewPanel({ file }: { file: AdminFileDetail }) {
  const review = useReviewFile()
  const [notes, setNotes] = useState(file.reviewNotes ?? '')
  const [confirming, setConfirming] = useState<Exclude<FileReviewStatus, 'pending'> | null>(null)
  const tooLong = notes.trim().length > NOTES_MAX
  const notesChanged = notes.trim() !== (file.reviewNotes ?? '')

  const save = async (status: FileReviewStatus) => {
    try {
      await review.mutateAsync({ id: file.id, status, notes })
      toast.success(status === file.reviewStatus ? 'Notes saved' : `Marked as ${FILE_REVIEW_LABEL[status].toLowerCase()}`)
    } catch (e) {
      toast.error(isRepositoryError(e, 'no_change') ? 'Nothing changed.' : describeError(e, 'Could not save the review. Please try again.'))
    } finally {
      setConfirming(null)
    }
  }

  return (
    <section aria-labelledby="fd-review" className="rounded-xl border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="fd-review" className="text-sm font-bold text-navy-900">Review</h3>
        <span className="flex items-center gap-2">
          <FileReviewBadge status={file.reviewStatus} />
          {file.reviewedAt && <span className="text-xs text-muted-ink">{formatDateTime(file.reviewedAt)}</span>}
        </span>
      </div>
      <Label htmlFor="fd-notes" className="mt-3 block text-sm">Administrator notes (internal)</Label>
      <Textarea
        id="fd-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        maxLength={NOTES_MAX + 50}
        aria-invalid={tooLong || undefined}
        aria-describedby="fd-notes-hint"
        className="mt-1.5 min-h-20 bg-white text-base"
      />
      <p id="fd-notes-hint" className={tooLong ? 'mt-1 text-xs font-medium text-destructive' : 'mt-1 text-xs text-muted-ink'}>
        {tooLong ? `Notes must be ${NOTES_MAX} characters or fewer.` : 'Not shown to the submitter. Saved with the decision.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Review decision">
        {file.reviewStatus !== 'approved' && (
          <Button className="h-11" disabled={review.isPending || tooLong} onClick={() => setConfirming('approved')}>
            <Check aria-hidden /> Approve
          </Button>
        )}
        {file.reviewStatus !== 'corrections_required' && (
          <Button variant="outline" className="h-11" disabled={review.isPending || tooLong} onClick={() => setConfirming('corrections_required')}>
            <MessageSquareWarning aria-hidden /> Request corrections
          </Button>
        )}
        {file.reviewStatus !== 'rejected' && (
          <Button variant="outline" className="h-11" disabled={review.isPending || tooLong} onClick={() => setConfirming('rejected')}>
            <X className="text-destructive" aria-hidden /> Reject
          </Button>
        )}
        {file.reviewStatus !== 'pending' && (
          <Button variant="ghost" className="h-11" disabled={review.isPending || tooLong} onClick={() => void save('pending')}>
            <Undo2 aria-hidden /> Back to pending
          </Button>
        )}
        <Button variant="ghost" className="h-11" disabled={review.isPending || tooLong || !notesChanged} onClick={() => void save(file.reviewStatus)}>
          {review.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save notes
        </Button>
      </div>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirming(null)}
          title={DECISION_COPY[confirming].title}
          description={DECISION_COPY[confirming].text}
          confirmLabel={DECISION_COPY[confirming].confirm}
          destructive={DECISION_COPY[confirming].destructive}
          loading={review.isPending}
          onConfirm={() => void save(confirming)}
        />
      )}
    </section>
  )
}

/** Loads one record by id. `id` null = closed. A missing or failing record shows an explanation, never a blank dialog. */
export function FileDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isPending, isError, error, refetch } = useAdminFile(id)
  const missing = isError && (isRepositoryError(error, 'not_found') || isRepositoryError(error, 'invalid_id'))

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review submission</DialogTitle>
          <DialogDescription>The submitted file, who sent it, and your decision.</DialogDescription>
        </DialogHeader>
        {isPending ? (
          <div aria-busy="true" aria-label="Loading file details" className="space-y-3">
            <SkeletonBlock className="h-20" />
            <SkeletonBlock className="h-16" />
          </div>
        ) : missing ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center">
            <FileX className="size-8 text-muted-ink" aria-hidden />
            <p className="font-semibold text-navy-900">This file record no longer exists</p>
            <p className="text-sm text-muted-ink">It may have been removed or the page was reloaded. Close this and refresh the list.</p>
          </div>
        ) : isError ? (
          <ErrorState message={describeError(error, "Could not load this file's details.")} onRetry={() => void refetch()} />
        ) : (
          <FileDetails
            file={data}
            download={<DownloadButton id={data.id} />}
            review={<ReviewPanel key={`${data.id}-${data.reviewStatus}-${data.reviewNotes ?? ''}`} file={data} />}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Asks for a short-lived download link and opens it straight away. The link is never stored, shown, logged or put in
 * the page URL; when it expires (about a minute) a new click creates a new one. The link is an attachment, so the browser
 * saves the file rather than opening it.
 */
function DownloadButton({ id }: { id: string }) {
  const download = useFileDownload()
  const start = async () => {
    try {
      const url = await download.mutateAsync(id)
      const a = document.createElement('a')
      a.href = url
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      toast.error(describeError(e, 'Could not download the file. Please try again.'))
    }
  }
  return (
    <div className="space-y-2 rounded-lg border bg-surface px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink">The file is stored privately. Downloading creates a one-minute link for you only.</p>
        <Button className="h-11 shrink-0" disabled={download.isPending} onClick={() => void start()}>
          {download.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} Download
        </Button>
      </div>
      <p className="flex items-start gap-2 text-xs text-navy-900">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden />
        Treat this file as untrusted: it was uploaded by a member of the public. Open it in Protected View, do not enable macros or external content, and be
        careful with formulas.
      </p>
    </div>
  )
}
