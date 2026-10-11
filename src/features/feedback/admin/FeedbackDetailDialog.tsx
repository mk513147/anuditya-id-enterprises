import { FileX } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { StarRating } from '@/components/shared/StarRating'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSingleFlight } from '@/hooks/useSingleFlight'
import { formatDate, formatDateTime } from '@/lib/format'
import { isRepositoryError } from '@/services/errors'
import type { Feedback } from '@/types'
import { useAdminFeedbackItem, useSetFeedbackStatus } from '../adminHooks'
import { FeedbackStatusBadge } from './FeedbackStatusBadge'
import { moderationActions, moderationErrorMessage, type ModerationAction } from './moderation'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-ink">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-navy-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/** A bare date (the seeded samples) shows as a date; a full timestamp (real submissions) shows with its time. */
const submitted = (iso: string) => (iso.length > 10 ? formatDateTime(iso) : formatDate(iso))

/** Presentational: exactly what the model holds about a submission. No contact details are collected or shown. */
export function FeedbackDetails({ feedback }: { feedback: Feedback }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="Submitted by">{feedback.name}</Field>
        <Field label="School or organisation">{feedback.organization ?? <span className="font-normal text-muted-ink">Not given</span>}</Field>
        <Field label="Rating"><StarRating value={feedback.rating} /></Field>
        <Field label="Submitted">{submitted(feedback.createdAt)}</Field>
        <Field label="Status"><FeedbackStatusBadge status={feedback.status} /></Field>
        <Field label="Shown publicly">{feedback.status === 'approved' ? 'Yes' : 'No'}</Field>
      </dl>
      <figure className="rounded-xl border bg-surface p-4">
        <figcaption className="text-xs font-medium text-muted-ink">Message</figcaption>
        <blockquote className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">{feedback.message}</blockquote>
      </figure>
    </div>
  )
}

function Moderation({ feedback }: { feedback: Feedback }) {
  const set = useSetFeedbackStatus()
  const [pending, setPending] = useState<ModerationAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const singleFlight = useSingleFlight()

  const confirm = () =>
    singleFlight(async () => {
      if (!pending) return
      setError(null)
      try {
        await set.mutateAsync({ id: feedback.id, status: pending.to })
        toast.success(`Feedback ${pending.done}`, { description: `From ${feedback.name}.` })
      } catch (e) {
        const message = moderationErrorMessage(e)
        setError(message)
        toast.error(message)
      } finally {
        setPending(null)
      }
    })

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {moderationActions(feedback.status).map((a) => (
          <Button key={a.to} type="button" size="lg" variant={a.to === 'approved' ? 'default' : 'outline'} disabled={set.isPending} onClick={() => { setError(null); setPending(a) }}>
            {a.label}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-ink">Only approved feedback is shown on the website. You will be asked to confirm.</p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-red-50 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${pending.label} this feedback?` : ''}
        description={
          <div className="space-y-2 text-sm">
            <p>
              From <strong>{feedback.name}</strong> ({feedback.rating}/5).
            </p>
            <p>{pending?.confirmBody}</p>
          </div>
        }
        confirmLabel={pending?.label ?? 'Confirm'}
        destructive={pending?.destructive}
        loading={set.isPending}
        onConfirm={() => void confirm()}
      />
    </div>
  )
}

/** Loads one submission by id. `id` null = closed. A missing or failing record shows an explanation. */
export function FeedbackDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isPending, isError, error, refetch } = useAdminFeedbackItem(id)
  const missing = isError && (isRepositoryError(error, 'not_found') || isRepositoryError(error, 'invalid_id'))

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Review feedback</DialogTitle>
          <DialogDescription>Read the submission, then approve or reject it.</DialogDescription>
        </DialogHeader>
        {isPending ? (
          <div aria-busy="true" aria-label="Loading feedback" className="space-y-3">
            <SkeletonBlock className="h-24" />
            <SkeletonBlock className="h-20" />
          </div>
        ) : missing ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-6 text-center">
            <FileX className="size-8 text-muted-ink" aria-hidden />
            <p className="font-semibold text-navy-900">This feedback no longer exists</p>
            <p className="text-sm text-muted-ink">It may have been removed or the page was reloaded. Close this and refresh the list.</p>
          </div>
        ) : isError ? (
          <ErrorState message="Could not load this feedback." onRetry={() => void refetch()} />
        ) : (
          <>
            <FeedbackDetails feedback={data} />
            <Moderation key={data.status} feedback={data} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
