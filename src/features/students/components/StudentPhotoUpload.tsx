import { CheckCircle2, ImagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type Ref } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES, validatePhotoFile } from '@/validations/student'

interface Props {
  id: string
  value: File | undefined
  onChange: (file: File | undefined) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
  /** Focus target for react-hook-form's focus-on-error. */
  ref?: Ref<HTMLButtonElement>
}

/**
 * Photo picker with preview. The preview uses an object URL that is created in the event handler
 * and revoked on replace/remove/unmount, so nothing leaks. Nothing is uploaded or persisted.
 */
export function StudentPhotoUpload({ id, value, onChange, onBlur, invalid, describedBy, ref }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const select = (file: File | undefined) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = file && !validatePhotoFile(file) ? URL.createObjectURL(file) : null
    setPreviewUrl(urlRef.current)
    onChange(file)
    // Allow picking the same file again after removing it.
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) select(file)
  }

  const openPicker = () => inputRef.current?.click()
  const hasPreview = !!value && !!previewUrl

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => select(e.target.files?.[0])}
      />

      {hasPreview ? (
        <div className="flex flex-col gap-4 rounded-2xl border bg-white p-3 min-[420px]:flex-row min-[420px]:items-center sm:p-4">
          <img
            src={previewUrl}
            alt="Selected student photo preview"
            className="h-40 w-32 shrink-0 self-center rounded-xl border object-cover min-[420px]:self-auto"
          />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden /> Photo selected
            </p>
            <p className="mt-1 break-all text-sm font-medium text-ink">{value.name}</p>
            <p className="text-xs text-muted-ink">{formatBytes(value.size)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button ref={ref} id={id} type="button" variant="outline" size="sm" className="h-11" onClick={openPicker} onBlur={onBlur} aria-describedby={describedBy}>
                <ImagePlus aria-hidden /> Choose another photo
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-11 text-destructive hover:bg-red-50 hover:text-destructive" onClick={() => select(undefined)}>
                <Trash2 aria-hidden /> Remove photo
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          ref={ref}
          id={id}
          type="button"
          onClick={openPicker}
          onBlur={onBlur}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            dragging ? 'border-royal-500 bg-royal-50' : 'border-input bg-surface hover:border-royal-500 hover:bg-royal-50',
            invalid && 'border-destructive bg-red-50/50',
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-royal-100 text-royal-600">
            <ImagePlus className="size-6" aria-hidden />
          </span>
          <span className="font-display text-base font-bold text-navy-900">Upload Student Photo</span>
          <span className="text-sm text-muted-ink">Tap to choose a photo, or drag and drop it here</span>
          <span className="text-xs text-muted-ink">JPG, JPEG or PNG · up to {PHOTO_MAX_BYTES / (1024 * 1024)} MB</span>
        </button>
      )}
    </div>
  )
}
