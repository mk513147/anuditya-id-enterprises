import { CloudUpload } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'
import { ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB } from '@/validations/upload'

interface Props {
  onBrowse: () => void
  onDropFile: (file: File | undefined) => void
  invalid?: boolean
  describedBy?: string
  /** Focus the dropzone on mount (used after Remove so keyboard users are not dropped to the page top). */
  autoFocus?: boolean
}

/**
 * Large click / tap / drop target. It is a real <button>, so Enter and Space open the picker.
 * The actual file selection is done by the browser's native <input type="file"> owned by the parent.
 */
export function FileDropzone({ onBrowse, onDropFile, invalid, describedBy, autoFocus }: Props) {
  const [dragging, setDragging] = useState(false)

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    onDropFile(e.dataTransfer.files?.[0])
  }

  return (
    <button
      type="button"
      autoFocus={autoFocus}
      onClick={onBrowse}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={cn(
        'group flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:py-14',
        dragging ? 'scale-[1.01] border-royal-500 bg-royal-100' : 'border-input bg-surface hover:border-royal-500 hover:bg-royal-50',
        invalid && !dragging && 'border-destructive/60 bg-red-50/50',
      )}
    >
      <span className={cn('grid size-16 place-items-center rounded-full transition-colors sm:size-20', dragging ? 'bg-royal-600 text-white' : 'bg-royal-100 text-royal-600 group-hover:bg-royal-600 group-hover:text-white')}>
        <CloudUpload className="size-8 sm:size-10" aria-hidden />
      </span>
      <span className="font-display text-xl font-extrabold text-navy-900 sm:text-2xl">Upload your Excel or CSV file</span>
      <span className="text-sm text-muted-ink">
        <span className="hidden sm:inline">Drag and drop your file here, or </span>
        <span className="sm:hidden">Tap the button below to choose a file</span>
        <span className="hidden sm:inline">use the button below.</span>
      </span>
      <span className="mt-1 inline-flex min-h-12 items-center rounded-lg bg-royal-600 px-6 text-base font-semibold text-white shadow-sm transition-colors group-hover:bg-royal-700">
        Choose File
      </span>
      <span className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-ink">
        <span>Supported formats:</span>
        {ACCEPTED_EXTENSIONS.map((e) => (
          <span key={e} className="rounded-md bg-white px-2 py-0.5 font-semibold uppercase text-navy-900 ring-1 ring-border">
            .{e}
          </span>
        ))}
        <span>· Max {MAX_UPLOAD_MB} MB</span>
      </span>
    </button>
  )
}
