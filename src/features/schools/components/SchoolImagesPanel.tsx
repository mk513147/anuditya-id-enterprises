import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ImagePlus, Loader2, RotateCcw, Star, Trash2, Upload, XCircle } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { AdminCard } from '@/components/admin/AdminPageHeader'
import { ErrorState, SkeletonBlock } from '@/components/shared/QueryState'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { schoolRepository } from '@/services'
import { describeError, isRepositoryError } from '@/services/errors'
import type { ID } from '@/types'
import { SCHOOL_IMAGE_ACCEPT, SCHOOL_IMAGE_MAX_BATCH, SCHOOL_IMAGE_MAX_BYTES } from '@/validations/schoolImage'
import { useSchoolImages, useSetPrimaryImage } from '../hooks'
import { addToQueue, runBatch, type QueueItem, type QueueStatus } from '../imageBatch'

const STATUS: Record<QueueStatus, { text: string; cls: string }> = {
  ready: { text: 'Waiting', cls: 'text-muted-ink' },
  uploading: { text: 'Uploading…', cls: 'text-royal-700' },
  done: { text: 'Uploaded', cls: 'text-emerald-700' },
  failed: { text: 'Failed', cls: 'text-destructive' },
  invalid: { text: 'Not accepted', cls: 'text-destructive' },
  duplicate: { text: 'Already added', cls: 'text-gold-700' },
}

type Row = QueueItem & { previewUrl?: string }
const revoke = (rows: Row[]) => rows.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl))

function BulkImageUploader({ schoolId }: { schoolId: ID }) {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const abort = useRef<AbortController | null>(null)
  const [queue, setQueue] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [dragging, setDragging] = useState(false)
  // Local previews (object URLs) are created when a file is added and revoked when it leaves the list or the page closes.
  const latest = useRef<Row[]>([])
  useEffect(() => {
    latest.current = queue
  }, [queue])
  useEffect(() => () => revoke(latest.current), [])

  const add = (files: File[]) => {
    if (running) return
    const r = addToQueue(queue, files)
    const known = new Set(queue.map((q) => q.key))
    setQueue(r.queue.map((i) => (known.has(i.key) ? (queue.find((q) => q.key === i.key) as Row) : { ...i, previewUrl: i.status === 'invalid' ? undefined : URL.createObjectURL(i.file) })))
    if (r.overLimit) toast.warning(`Up to ${SCHOOL_IMAGE_MAX_BATCH} images per batch`, { description: `${r.overLimit} image${r.overLimit === 1 ? ' was' : 's were'} not added. Upload this batch first, then add the rest.` })
    if (r.skippedDuplicates) toast.info(`${r.skippedDuplicates} file${r.skippedDuplicates === 1 ? ' was' : 's were'} already in the list`)
  }
  const remove = (key: string) => {
    revoke(queue.filter((i) => i.key === key))
    setQueue(queue.filter((i) => i.key !== key))
  }
  const update = (key: string, patch: Partial<QueueItem>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const start = async () => {
    if (running) return // no duplicate submissions while a batch runs
    const ctrl = new AbortController()
    abort.current = ctrl
    setRunning(true)
    try {
      const t = await runBatch(queue, (file) => schoolRepository.uploadImage(schoolId, file), { onUpdate: update, signal: ctrl.signal })
      await qc.invalidateQueries({ queryKey: ['schools', 'images', schoolId] })
      const parts = [`${t.done} uploaded`, t.failed && `${t.failed} failed`, t.duplicate && `${t.duplicate} already added`, t.invalid && `${t.invalid} not accepted`].filter(Boolean).join(', ')
      if (t.failed || t.invalid) toast.warning('Some images were not uploaded', { description: `${parts}. Fix or retry the ones marked in the list.` })
      else if (t.done) toast.success(t.done === 1 ? 'Image uploaded' : `${t.done} images uploaded`, { description: parts })
    } finally {
      setRunning(false)
      abort.current = null
    }
  }

  const counts = (s: QueueStatus) => queue.filter((i) => i.status === s).length
  const pending = counts('ready') + counts('failed')
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    add([...e.dataTransfer.files])
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" multiple accept={SCHOOL_IMAGE_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose school images" onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = '' }} />
      <button
        type="button"
        disabled={running}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn('flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-60',
          dragging ? 'border-royal-500 bg-royal-100' : 'border-input bg-surface hover:border-royal-500 hover:bg-royal-50')}
      >
        <ImagePlus className="size-7 text-royal-600" aria-hidden />
        <span className="font-semibold text-navy-900">{queue.length ? 'Add more images' : 'Choose images'} or drop them here</span>
        <span className="text-xs text-muted-ink">JPEG, PNG or WebP · up to {SCHOOL_IMAGE_MAX_BYTES / (1024 * 1024)} MB each · up to {SCHOOL_IMAGE_MAX_BATCH} per batch</span>
      </button>

      {queue.length > 0 && (
        <>
          <p className="text-sm text-ink" aria-live="polite">
            {counts('done')} uploaded · {counts('ready')} waiting · {counts('failed')} failed
            {counts('invalid') + counts('duplicate') ? ` · ${counts('invalid') + counts('duplicate')} not uploaded` : ''}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2" aria-label="Images to upload">
            {queue.map((item) => {
              const st = STATUS[item.status]
              const url = item.status === 'invalid' ? undefined : item.previewUrl // never render a file that failed the content check
              return (
                <li key={item.key} className="flex items-center gap-3 rounded-lg border bg-white p-2">
                  {url ? <img src={url} alt="" className="size-14 shrink-0 rounded-md border object-cover" /> : <span className="grid size-14 shrink-0 place-items-center rounded-md border bg-surface text-muted-ink"><XCircle className="size-5" aria-hidden /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900" title={item.file.name}>{item.file.name}</span>
                    <span className="block text-xs text-muted-ink">{formatBytes(item.file.size)}</span>
                    <span className={cn('flex items-center gap-1 text-xs font-medium', st.cls)}>
                      {item.status === 'uploading' && <Loader2 className="size-3 animate-spin" aria-hidden />}
                      {item.status === 'done' && <CheckCircle2 className="size-3" aria-hidden />}
                      {st.text}{item.message ? `: ${item.message}` : ''}
                    </span>
                  </span>
                  {item.status !== 'uploading' && item.status !== 'done' && !running && (
                    <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${item.file.name}`} onClick={() => remove(item.key)}>
                      <Trash2 />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button type="button" variant="outline" className="h-11" onClick={() => abort.current?.abort()}>
                Stop after current uploads
              </Button>
            ) : (
              <Button type="button" className="h-11" disabled={pending === 0} onClick={() => void start()}>
                {counts('failed') && !counts('ready') ? <RotateCcw aria-hidden /> : <Upload aria-hidden />}
                {counts('failed') && !counts('ready') ? `Retry ${counts('failed')} failed` : `Upload ${pending} image${pending === 1 ? '' : 's'}`}
              </Button>
            )}
            {!running && (counts('done') + counts('duplicate') + counts('invalid')) > 0 && (
              <Button type="button" variant="ghost" className="h-11" onClick={() => { revoke(queue.filter((i) => i.status !== 'ready' && i.status !== 'failed')); setQueue(queue.filter((i) => i.status === 'ready' || i.status === 'failed')) }}>
                Clear finished
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** The school's images (private; shown through short-lived links) and the bulk uploader. */
export function SchoolImagesPanel({ schoolId }: { schoolId: ID }) {
  const { data: images, isPending, isError, error, refetch } = useSchoolImages(schoolId)
  const setPrimary = useSetPrimaryImage(schoolId)

  const makePrimary = async (id: ID) => {
    try {
      await setPrimary.mutateAsync(id)
      toast.success('Primary image changed')
    } catch (e) {
      toast.error(isRepositoryError(e, 'no_change') ? 'That is already the primary image.' : describeError(e, 'Could not change the primary image.'))
    }
  }

  return (
    <AdminCard title="School images">
      <div className="space-y-5 p-4 sm:p-6">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy="true" aria-label="Loading images">
            {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="aspect-[4/3]" />)}
          </div>
        ) : isError ? (
          <ErrorState message={describeError(error, 'Could not load the images.')} onRetry={() => void refetch()} />
        ) : images.length === 0 ? (
          <p className="text-sm text-muted-ink">No images yet. The first image you upload becomes the school’s primary image.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Images of this school">
            {images.map((img) => (
              <li key={img.id} className="overflow-hidden rounded-xl border bg-white">
                {img.url ? (
                  <img src={img.url} alt={img.altText ?? img.originalName} className="aspect-[4/3] w-full bg-surface object-cover" loading="lazy" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-surface text-xs text-muted-ink">Preview unavailable</div>
                )}
                <div className="space-y-1 p-2">
                  <p className="truncate text-xs font-semibold text-navy-900" title={img.originalName}>{img.originalName}</p>
                  <p className="text-xs text-muted-ink">{formatBytes(img.sizeBytes)}</p>
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
        <BulkImageUploader schoolId={schoolId} />
        <p className="text-xs text-muted-ink">Images are stored privately and shown here through links that expire after a few minutes.</p>
      </div>
    </AdminCard>
  )
}
