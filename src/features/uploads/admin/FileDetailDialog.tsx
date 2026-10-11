import { FileX } from 'lucide-react'
import type { ReactNode } from 'react'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatBytes, formatDateTime } from '@/lib/format'
import { isRepositoryError } from '@/services/errors'
import type { AdminFile } from '@/services/types'
import { FILE_TYPE_LABEL } from '@/validations/upload'
import { useAdminFile } from '../adminHooks'
import { NO_SCHOOL } from './fileColumns'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-ink">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-navy-900 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

/**
 * Presentational: exactly what the repository holds about a file. There is no download action because the
 * prototype keeps metadata only, and the dialog says so instead of offering a button that cannot work.
 */
export function FileDetails({ file }: { file: AdminFile }) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="File name">{file.originalName}</Field>
        <Field label="Reference">
          <span className="font-mono">{file.referenceNo}</span>
        </Field>
        <Field label="Format">{FILE_TYPE_LABEL[file.type]}</Field>
        <Field label="Size">
          {formatBytes(file.sizeBytes)} ({file.sizeBytes.toLocaleString('en-IN')} bytes)
        </Field>
        <Field label="Uploaded">{formatDateTime(file.uploadedAt)}</Field>
        <Field label="School">{file.schoolName ?? <span className="font-normal text-muted-ink">{NO_SCHOOL}</span>}</Field>
      </dl>
      {!file.schoolName && (
        <p className="text-xs text-muted-ink">The public upload page does not ask for a school, so uploads made there have none recorded.</p>
      )}
      <p role="note" className="rounded-lg border border-gold-400/40 bg-gold-100 px-3 py-2 text-sm text-navy-900">
        <strong>File contents are not available.</strong> This prototype records details about each upload but does not keep the file itself, so it
        cannot be opened or downloaded. Real file storage, and downloads, arrive with the Supabase phase. Records here reset when the page is reloaded.
      </p>
    </div>
  )
}

/** Loads one record by id. `id` null = closed. A missing or failing record shows an explanation, never a blank dialog. */
export function FileDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isPending, isError, error, refetch } = useAdminFile(id)
  const missing = isError && (isRepositoryError(error, 'not_found') || isRepositoryError(error, 'invalid_id'))

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>File details</DialogTitle>
          <DialogDescription>What the system holds about this upload.</DialogDescription>
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
          <ErrorState message="Could not load this file's details." onRetry={() => void refetch()} />
        ) : (
          <FileDetails file={data} />
        )}
      </DialogContent>
    </Dialog>
  )
}
