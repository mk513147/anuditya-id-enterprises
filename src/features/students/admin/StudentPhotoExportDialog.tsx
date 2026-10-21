import { FileArchive, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadBlob } from '@/lib/download'
import { studentRepository } from '@/services'
import { describeError } from '@/services/errors'
import type { StudentListParams } from '@/services/types'
import { buildStudentPhotoExport, PHOTO_EXPORT_MAX_STUDENTS, photoExportFilename, PhotoExportTooLarge, type PhotoExportStage } from './studentPhotoExport'

type Phase = { kind: 'ready' } | { kind: 'rows' } | { kind: 'working'; progress: PhotoExportStage } | { kind: 'done'; included: number; missing: number; failed: number }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current list filters: the export covers exactly the students they match (all pages). */
  params: StudentListParams
  /** How many students the current filters match. */
  matching: number
}

/**
 * Students with photos (.xlsx + images, as a ZIP). Everything happens in this browser tab and in memory: the archive is
 * handed to the browser's download and released straight away. Nothing is stored, logged or uploaded.
 */
export function StudentPhotoExportDialog({ open, onOpenChange, params, matching }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  const abort = useRef<AbortController | null>(null)
  const busy = phase.kind === 'rows' || phase.kind === 'working'
  const tooMany = matching > PHOTO_EXPORT_MAX_STUDENTS

  const close = (o: boolean) => {
    if (o) return onOpenChange(true)
    abort.current?.abort()
    setPhase({ kind: 'ready' })
    onOpenChange(false)
  }

  const start = async () => {
    const ctrl = new AbortController()
    abort.current = ctrl
    try {
      setPhase({ kind: 'rows' })
      const { rows, truncated } = await studentRepository.exportRows({ ...params, page: undefined, pageSize: undefined })
      if (ctrl.signal.aborted) return
      if (rows.length === 0) {
        toast.info('Nothing to export', { description: 'No students match the current filters.' })
        return close(false)
      }
      if (truncated || rows.length > PHOTO_EXPORT_MAX_STUDENTS) throw new PhotoExportTooLarge(`An export with photos is limited to ${PHOTO_EXPORT_MAX_STUDENTS} students. Narrow the filters and export in parts.`)
      const { blob, rows: out } = await buildStudentPhotoExport(rows, (ids, o) => studentRepository.downloadPhotos(ids, o), {
        signal: ctrl.signal,
        onProgress: (progress) => setPhase({ kind: 'working', progress }),
      })
      downloadBlob(photoExportFilename(), blob)
      setPhase({
        kind: 'done',
        included: out.filter((r) => r.photoStatus === 'included').length,
        missing: out.filter((r) => r.photoStatus === 'no_photo').length,
        failed: out.filter((r) => r.photoStatus === 'failed').length,
      })
    } catch (e) {
      if (ctrl.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        toast.info('Export cancelled')
        return
      }
      setPhase({ kind: 'ready' })
      toast.error(e instanceof PhotoExportTooLarge ? e.message : describeError(e, 'Could not create the export. Please try again.'))
    }
  }

  let progressText = ''
  let percent = 0
  if (phase.kind === 'rows') {
    progressText = 'Reading the student records…'
    percent = 2
  } else if (phase.kind === 'working') {
    const p = phase.progress
    if (p.stage === 'photos') {
      progressText = `Downloading photographs: ${p.done} of ${p.total}`
      percent = Math.round((p.done / Math.max(1, p.total)) * 90)
    } else {
      progressText = `Building the archive: ${p.percent}%`
      percent = 90 + Math.round(p.percent / 10)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => busy && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Export students with photos</DialogTitle>
          <DialogDescription>
            A ZIP file with <strong>students.xlsx</strong>, a <strong>student_photos</strong> folder and a README. It covers the{' '}
            <strong>{matching}</strong> {matching === 1 ? 'student' : 'students'} matching the current filters (all pages).
          </DialogDescription>
        </DialogHeader>

        {phase.kind === 'done' ? (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Downloaded. {phase.included} photo{phase.included === 1 ? '' : 's'} included
            {phase.missing ? `, ${phase.missing} without a photo on record` : ''}
            {phase.failed ? `, ${phase.failed} could not be downloaded (marked in the workbook)` : ''}. The file contains personal data: store it securely.
          </p>
        ) : busy ? (
          <div role="status" aria-live="polite" className="space-y-2">
            <p className="text-sm text-ink">{progressText}</p>
            <div className="h-2 overflow-hidden rounded-full bg-royal-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Export progress">
              <div className="h-full rounded-full bg-royal-600 transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : tooMany ? (
          <p role="alert" className="rounded-lg border border-gold-400/50 bg-gold-100 px-3 py-2 text-sm text-navy-900">
            An export with photos is limited to {PHOTO_EXPORT_MAX_STUDENTS} students at a time, so it can be built safely in the browser. Narrow the filters
            (for example by school or class) and export in parts.
          </p>
        ) : (
          <p className="text-sm text-muted-ink">Students without a photograph are still listed, marked “No photo on record”. The export runs in this browser tab; keep it open until it finishes.</p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" size="lg" onClick={() => close(false)}>
            {busy ? 'Cancel export' : 'Close'}
          </Button>
          {phase.kind !== 'done' && (
            <Button type="button" size="lg" disabled={busy || tooMany || matching === 0} onClick={() => void start()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <FileArchive aria-hidden />}
              {busy ? 'Exporting…' : 'Export ZIP'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
