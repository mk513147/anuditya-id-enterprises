import { CheckCircle2, ImagePlus, Loader2, Trash2, XCircle } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { SCHOOL_IMAGE_ACCEPT, SCHOOL_IMAGE_MAX_BATCH, SCHOOL_IMAGE_MAX_BYTES } from '@/validations/schoolImage'
import type { QueueStatus } from '../imageBatch'
import type { QueueRow } from '../useImageQueue'

/**
 * The image picker, drop zone and per-file list, shared by the administrator's "School images" uploader and the public
 * "Submit School Images" form (one implementation, so both always validate and report the same way).
 */
const STATUS: Record<QueueStatus, { text: string; cls: string }> = {
  ready: { text: 'Waiting', cls: 'text-muted-ink' },
  uploading: { text: 'Uploading…', cls: 'text-royal-700' },
  done: { text: 'Uploaded', cls: 'text-emerald-700' },
  failed: { text: 'Failed', cls: 'text-destructive' },
  invalid: { text: 'Not accepted', cls: 'text-destructive' },
  duplicate: { text: 'Already present', cls: 'text-gold-700' },
}


export function ImageDropzone({ onFiles, disabled, hasFiles, id, describedBy, invalid }: { onFiles: (files: File[]) => void; disabled?: boolean; hasFiles: boolean; id: string; describedBy?: string; invalid?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!disabled) onFiles([...e.dataTransfer.files])
  }
  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        accept={SCHOOL_IMAGE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose school images"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])])
          e.target.value = '' // the same file can be chosen again later
        }}
      />
      {/* A real button: Enter / Space open the picker. Drag-and-drop is an extra, not the only way. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn('flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-60',
          dragging ? 'border-royal-500 bg-royal-100' : 'border-input bg-surface hover:border-royal-500 hover:bg-royal-50',
          invalid && !dragging && 'border-destructive/60 bg-red-50/50')}
      >
        <ImagePlus className="size-7 text-royal-600" aria-hidden />
        <span className="font-semibold text-navy-900">{hasFiles ? 'Add more images' : 'Choose images'} or drop them here</span>
        <span className="text-xs text-muted-ink">JPEG, PNG or WebP · up to {SCHOOL_IMAGE_MAX_BYTES / (1024 * 1024)} MB each · up to {SCHOOL_IMAGE_MAX_BATCH} per batch</span>
      </button>
    </>
  )
}

export function ImageQueueList({ queue, onRemove, locked, label = 'Images to upload' }: { queue: QueueRow[]; onRemove: (key: string) => void; locked: boolean; label?: string }) {
  if (queue.length === 0) return null
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label={label}>
      {queue.map((item) => {
        const st = STATUS[item.status]
        const url = item.status === 'invalid' ? undefined : item.previewUrl // never render a file that failed the content check
        return (
          <li key={item.key} className="flex min-w-0 items-center gap-3 rounded-lg border bg-white p-2">
            {url ? (
              <img src={url} alt="" className="size-14 shrink-0 rounded-md border object-cover" />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-md border bg-surface text-muted-ink"><XCircle className="size-5" aria-hidden /></span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-navy-900" title={item.file.name}>{item.file.name}</span>
              <span className="block text-xs text-muted-ink">{formatBytes(item.file.size)}</span>
              <span className={cn('flex items-center gap-1 text-xs font-medium', st.cls)}>
                {item.status === 'uploading' && <Loader2 className="size-3 animate-spin" aria-hidden />}
                {item.status === 'done' && <CheckCircle2 className="size-3" aria-hidden />}
                {st.text}{item.message ? `: ${item.message}` : ''}
              </span>
            </span>
            {item.status !== 'uploading' && item.status !== 'done' && !locked && (
              <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Remove ${item.file.name}`} onClick={() => onRemove(item.key)}>
                <Trash2 />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
