import { useQueryClient } from '@tanstack/react-query'
import { Check, RotateCcw, Star, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { AdminCard } from '@/components/admin/AdminPageHeader'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { formatBytes, formatDateTime } from '@/lib/format'
import { schoolRepository } from '@/services'
import { describeError, isRepositoryError } from '@/services/errors'
import type { ID, SchoolImage, SchoolImageStatus } from '@/types'
import { useReviewImage, useSchoolImages, useSetPrimaryImage } from '../hooks'
import { runBatch } from '../imageBatch'
import { useImageQueue } from '../useImageQueue'
import { ImageDropzone, ImageQueueList } from './ImageQueue'

/** The administrator's bulk uploader (approved immediately). Same queue, checks and storage as the public form. */
function BulkImageUploader({ schoolId }: { schoolId: ID }) {
  const qc = useQueryClient()
  const abort = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const q = useImageQueue({ locked: running })

  const start = async () => {
    if (running) return // no duplicate submissions while a batch runs
    const ctrl = new AbortController()
    abort.current = ctrl
    setRunning(true)
    try {
      const t = await runBatch(q.queue, (file) => schoolRepository.uploadImage(schoolId, file), { onUpdate: q.update, signal: ctrl.signal })
      await qc.invalidateQueries({ queryKey: ['schools', 'images', schoolId] })
      const parts = [`${t.done} uploaded`, t.failed && `${t.failed} failed`, t.duplicate && `${t.duplicate} already present`, t.invalid && `${t.invalid} not accepted`].filter(Boolean).join(', ')
      if (t.failed || t.invalid) toast.warning('Some images were not uploaded', { description: `${parts}. Fix or retry the ones marked in the list.` })
      else if (t.done) toast.success(t.done === 1 ? 'Image uploaded' : `${t.done} images uploaded`, { description: parts })
    } finally {
      setRunning(false)
      abort.current = null
    }
  }

  const pending = q.count('ready') + q.count('failed')
  return (
    <div className="space-y-3">
      <ImageDropzone id="admin-school-images" onFiles={q.add} disabled={running} hasFiles={q.queue.length > 0} />
      {q.queue.length > 0 && (
        <>
          <p className="text-sm text-ink" aria-live="polite">
            {q.count('done')} uploaded · {q.count('ready')} waiting · {q.count('failed')} failed
            {q.count('invalid') + q.count('duplicate') ? ` · ${q.count('invalid') + q.count('duplicate')} not uploaded` : ''}
          </p>
          <ImageQueueList queue={q.queue} onRemove={q.remove} locked={running} />
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button type="button" variant="outline" className="h-11" onClick={() => abort.current?.abort()}>
                Stop after current uploads
              </Button>
            ) : (
              <Button type="button" className="h-11" disabled={pending === 0} onClick={() => void start()}>
                {q.count('failed') && !q.count('ready') ? <RotateCcw aria-hidden /> : <Upload aria-hidden />}
                {q.count('failed') && !q.count('ready') ? `Retry ${q.count('failed')} failed` : `Upload ${pending} image${pending === 1 ? '' : 's'}`}
              </Button>
            )}
            {!running && q.count('done') + q.count('duplicate') + q.count('invalid') > 0 && (
              <Button type="button" variant="ghost" className="h-11" onClick={q.clearFinished}>
                Clear finished
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Thumb({ img }: { img: SchoolImage }) {
  return img.url ? (
    <img src={img.url} alt={img.altText ?? img.originalName} className="aspect-[4/3] w-full bg-surface object-cover" loading="lazy" />
  ) : (
    <div className="grid aspect-[4/3] place-items-center bg-surface text-xs text-muted-ink">Preview unavailable</div>
  )
}

/** The school's images (private; shown through short-lived links): approved, awaiting review, rejected; and the uploader. */
export function SchoolImagesPanel({ schoolId }: { schoolId: ID }) {
  const { data: images, isPending, isError, error, refetch } = useSchoolImages(schoolId)
  const setPrimary = useSetPrimaryImage(schoolId)
  const review = useReviewImage(schoolId)
  const [showRejected, setShowRejected] = useState(false)

  const makePrimary = async (id: ID) => {
    try {
      await setPrimary.mutateAsync(id)
      toast.success('Primary image changed')
    } catch (e) {
      toast.error(isRepositoryError(e, 'no_change') ? 'That is already the primary image.' : describeError(e, 'Could not change the primary image.'))
    }
  }
  const decide = async (img: SchoolImage, decision: SchoolImageStatus) => {
    try {
      await review.mutateAsync({ id: img.id, decision })
      toast.success(decision === 'approved' ? 'Image approved' : 'Image rejected', { description: img.originalName })
    } catch (e) {
      toast.error(describeError(e, 'Could not save the decision. Please try again.'))
    }
  }

  const approved = images?.filter((i) => i.reviewStatus === 'approved') ?? []
  const pending = images?.filter((i) => i.reviewStatus === 'pending') ?? []
  const rejected = images?.filter((i) => i.reviewStatus === 'rejected') ?? []

  return (
    <AdminCard title="School images">
      <div className="space-y-6 p-4 sm:p-6">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Loading images">
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="aspect-[4/3]" />)}
          </div>
        ) : isError ? (
          <ErrorState message={describeError(error, 'Could not load the images.')} onRetry={() => void refetch()} />
        ) : (
          <>
            {pending.length > 0 && (
              <section aria-labelledby="img-pending" className="rounded-xl border border-gold-400/50 bg-gold-100/40 p-3 sm:p-4">
                <h3 id="img-pending" className="mb-3 text-sm font-bold text-navy-900">Awaiting review ({pending.length}) · submitted from the website</h3>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Images awaiting review">
                  {pending.map((img) => (
                    <li key={img.id} className="overflow-hidden rounded-xl border bg-white">
                      <Thumb img={img} />
                      <div className="space-y-1 p-2 text-xs">
                        <p className="truncate font-semibold text-navy-900" title={img.originalName}>{img.originalName}</p>
                        <p className="text-muted-ink">{formatBytes(img.sizeBytes)} · {formatDateTime(img.createdAt)}</p>
                        {img.submission && (
                          <p className="text-ink [overflow-wrap:anywhere]">
                            From <strong>{img.submission.contactPerson}</strong> ({img.submission.contactDetails})
                            {img.submission.note && <span className="mt-0.5 block whitespace-pre-line text-muted-ink">“{img.submission.note}”</span>}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <Button type="button" size="sm" className="h-9" disabled={review.isPending} onClick={() => void decide(img, 'approved')} aria-label={`Approve ${img.originalName}`}>
                            <Check aria-hidden /> Approve
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="h-9" disabled={review.isPending} onClick={() => void decide(img, 'rejected')} aria-label={`Reject ${img.originalName}`}>
                            <X className="text-destructive" aria-hidden /> Reject
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-ink">Submitted images are not used until approved. Treat them as untrusted uploads from the public.</p>
              </section>
            )}

            {approved.length === 0 ? (
              <p className="text-sm text-muted-ink">No approved images yet. The first image you upload becomes the school’s primary image.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Images of this school">
                {approved.map((img) => (
                  <li key={img.id} className="overflow-hidden rounded-xl border bg-white">
                    <Thumb img={img} />
                    <div className="space-y-1 p-2">
                      <p className="truncate text-xs font-semibold text-navy-900" title={img.originalName}>{img.originalName}</p>
                      <p className="text-xs text-muted-ink">{formatBytes(img.sizeBytes)}{img.source === 'public' ? ' · from the website' : ''}</p>
                      {img.isPrimary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-700"><Star className="size-3" aria-hidden /> Primary image</span>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="h-9 w-full" disabled={setPrimary.isPending} onClick={() => void makePrimary(img.id)} aria-label={`Make ${img.originalName} the primary image`}>
                          <Star aria-hidden /> Make primary
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {rejected.length > 0 && (
              <div>
                <Button type="button" variant="ghost" size="sm" className="h-9 px-2" aria-expanded={showRejected} onClick={() => setShowRejected((v) => !v)}>
                  {showRejected ? 'Hide' : 'Show'} rejected submissions ({rejected.length})
                </Button>
                {showRejected && (
                  <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Rejected images">
                    {rejected.map((img) => (
                      <li key={img.id} className="overflow-hidden rounded-xl border bg-white opacity-80">
                        <Thumb img={img} />
                        <div className="space-y-1 p-2 text-xs">
                          <p className="truncate font-semibold text-navy-900" title={img.originalName}>{img.originalName}</p>
                          <Button type="button" variant="outline" size="sm" className="h-9 w-full" disabled={review.isPending} onClick={() => void decide(img, 'approved')} aria-label={`Approve ${img.originalName}`}>
                            <Check aria-hidden /> Approve
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
        <BulkImageUploader schoolId={schoolId} />
        <p className="text-xs text-muted-ink">Images are stored privately and shown here through links that expire after a few minutes.</p>
      </div>
    </AdminCard>
  )
}
