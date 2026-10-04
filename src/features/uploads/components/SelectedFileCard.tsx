import { FileSpreadsheet, ImagePlus, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/format'
import { FILE_TYPE_LABEL, getExtension } from '@/validations/upload'
import type { UploadedFileType } from '@/types'

interface Props {
  file: File
  /** ready: shows Remove / Replace / Upload. Other modes show the file only (actions live elsewhere). */
  mode: 'ready' | 'busy'
  onRemove?: () => void
  onReplace?: () => void
  onUpload?: () => void
}

export function SelectedFileCard({ file, mode, onRemove, onReplace, onUpload }: Props) {
  const type = getExtension(file.name) as UploadedFileType
  return (
    <div className="rounded-2xl border bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-royal-600 text-white sm:size-14">
          <FileSpreadsheet className="size-6 sm:size-7" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-base font-bold leading-snug text-navy-900 [overflow-wrap:anywhere] sm:text-lg" data-testid="selected-file-name">
            {file.name}
          </p>
          <p className="mt-1 text-sm text-muted-ink">{FILE_TYPE_LABEL[type]}</p>
          <p className="text-sm font-medium text-ink">{formatBytes(file.size)}</p>
        </div>
      </div>

      {mode === 'ready' && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {/* Focus lands here right after a file is chosen, so the next keystroke can upload it. */}
          <Button type="button" size="lg" autoFocus className="col-span-2 sm:col-span-1 sm:min-w-44" onClick={onUpload}>
            <Upload aria-hidden /> Upload File
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onReplace}>
            <ImagePlus aria-hidden /> Replace
          </Button>
          <Button type="button" variant="ghost" size="lg" className="text-destructive hover:bg-red-50 hover:text-destructive" onClick={onRemove}>
            <Trash2 aria-hidden /> Remove
          </Button>
        </div>
      )}
    </div>
  )
}
