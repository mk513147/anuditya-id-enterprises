import { exportDate } from '@/lib/download'
import { buildWorkbook, type XlsxColumn } from '@/lib/xlsx'
import type { AdminStudent, StudentPhotoResult } from '@/services/types'
import type { ID } from '@/types'
import { STUDENT_EXPORT_COLUMNS, STUDENT_SHEET_NAME } from './studentExport'

/**
 * "Export students with photos": a ZIP with students.xlsx, student_photos/ and README.txt, built in the browser for the
 * signed-in administrator. Limits keep it within what a browser handles safely; larger exports need a server-side job.
 */
export const PHOTO_EXPORT_MAX_STUDENTS = 500
export const PHOTO_EXPORT_MAX_BYTES = 400 * 1024 * 1024
export const PHOTO_EXPORT_CONCURRENCY = 4
export const PHOTO_DIR = 'student_photos'

export type PhotoStatus = 'included' | 'no_photo' | 'failed'
export const PHOTO_STATUS_LABEL: Record<PhotoStatus, string> = { included: 'Included', no_photo: 'No photo on record', failed: 'Download failed' }

export interface PhotoExportRow {
  student: AdminStudent
  photoFile?: string
  photoStatus: PhotoStatus
}

export type PhotoExportStage = { stage: 'photos'; done: number; total: number } | { stage: 'archive'; percent: number }

/**
 * Stable, safe file name for a student's photo: the reference number (letters, digits and hyphens only) plus the first
 * 8 hex characters of the student's id, so two rows can never share a file and no personal name appears in the path.
 */
export function photoFileName(student: Pick<AdminStudent, 'id' | 'referenceNo'>, ext: 'jpg' | 'png'): string {
  const ref = student.referenceNo.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) || 'student'
  const suffix = student.id.replace(/[^A-Za-z0-9]/g, '').toLowerCase().slice(0, 8) || '00000000'
  return `${ref}_${suffix}.${ext}`
}

/** The photo's real format from its first bytes (not the stored content type): JPEG or PNG, else null. */
export function imageExtension(b: Uint8Array): 'jpg' | 'png' | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return 'png'
  return null
}

const PHOTO_COLUMNS: XlsxColumn<PhotoExportRow>[] = [
  ...STUDENT_EXPORT_COLUMNS.map((c) => ({ ...c, value: (r: PhotoExportRow) => c.value(r.student) })),
  { header: 'Photo file', value: (r) => (r.photoFile ? `${PHOTO_DIR}/${r.photoFile}` : undefined), width: 42 },
  { header: 'Photo status', value: (r) => PHOTO_STATUS_LABEL[r.photoStatus], width: 20 },
]

export function readme(rows: PhotoExportRow[], now: Date): string {
  const count = (s: PhotoStatus) => rows.filter((r) => r.photoStatus === s).length
  return [
    'Anuditya ID - student export with photographs',
    `Exported: ${exportDate(now)} (India time)`,
    '',
    `Students: ${rows.length}`,
    `Photographs included: ${count('included')}`,
    `No photograph on record: ${count('no_photo')}`,
    `Photograph download failed: ${count('failed')}`,
    '',
    'Contents',
    '  students.xlsx       one row per student (worksheet "Students")',
    `  ${PHOTO_DIR}/     the photographs`,
    '',
    'Columns',
    ...PHOTO_COLUMNS.map((c) => `  - ${c.header}`),
    '',
    'Photograph names',
    `  Each photograph is ${PHOTO_DIR}/<Reference No>_<first 8 characters of the internal student id>.<jpg|png>.`,
    '  The "Photo file" column of each row gives the exact file for that student. Rows marked',
    '  "No photo on record" or "Download failed" have no file; the student details are still included.',
    '',
    'This archive contains personal data about students. Store it securely and delete it when it is no longer needed.',
    '',
  ].join('\r\n')
}

/**
 * Downloads the photos (bounded concurrency), then builds the archive. `download` is the repository's downloadPhotos.
 * Each photo is matched to the id it was requested for; a failure or a missing photo never drops the student.
 */
export async function buildStudentPhotoExport(
  students: AdminStudent[],
  download: (ids: ID[], o: { concurrency: number; signal?: AbortSignal; onPhoto: (id: ID, r: StudentPhotoResult) => void }) => Promise<void>,
  { signal, onProgress = () => {}, now = new Date(), maxBytes = PHOTO_EXPORT_MAX_BYTES }: { signal?: AbortSignal; onProgress?: (p: PhotoExportStage) => void; now?: Date; maxBytes?: number } = {},
): Promise<{ blob: Blob; rows: PhotoExportRow[] }> {
  if (students.length > PHOTO_EXPORT_MAX_STUDENTS) throw new PhotoExportTooLarge(`An export with photos is limited to ${PHOTO_EXPORT_MAX_STUDENTS} students. Narrow the filters (for example by school or class) and export in parts.`)
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const folder = zip.folder(PHOTO_DIR)!
  const byId = new Map(students.map((s) => [s.id, s]))
  const status = new Map<ID, { status: PhotoStatus; file?: string }>()
  let bytes = 0
  let done = 0
  let tooLarge = false
  const pending: Promise<void>[] = [] // format checks still running for downloaded photos
  onProgress({ stage: 'photos', done: 0, total: students.length })

  await download(students.map((s) => s.id), {
    concurrency: PHOTO_EXPORT_CONCURRENCY,
    signal,
    onPhoto: (id, result) => {
      const student = byId.get(id)
      if (!student || status.has(id)) return // never attach a photo to a student that was not requested, or twice
      if (result.status === 'ok') {
        bytes += result.blob.size
        if (bytes > maxBytes) tooLarge = true
        status.set(id, { status: 'failed' }) // provisional until the format is confirmed below
        pending.push(
          result.blob.arrayBuffer().then((buf) => {
            const bytes = new Uint8Array(buf)
            const ext = imageExtension(bytes)
            if (!ext || tooLarge) return
            const file = photoFileName(student, ext)
            folder.file(file, bytes, { binary: true, compression: 'STORE' }) // photos are already compressed
            status.set(id, { status: 'included', file })
          }),
        )
      } else {
        status.set(id, { status: result.status === 'missing' ? 'no_photo' : 'failed' })
      }
      onProgress({ stage: 'photos', done: ++done, total: students.length })
    },
  })
  await Promise.all(pending)
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError')
  if (tooLarge) throw new PhotoExportTooLarge('The photographs are too large to package in the browser. Narrow the filters and export in parts.')

  const rows: PhotoExportRow[] = students.map((s) => {
    const st = status.get(s.id) ?? { status: 'failed' as const }
    return { student: s, photoStatus: st.status, photoFile: st.file }
  })
  zip.file('students.xlsx', await buildWorkbook([{ name: STUDENT_SHEET_NAME, columns: PHOTO_COLUMNS, rows }], { title: 'Anuditya ID – students with photos' }), { binary: true, compression: 'STORE' })
  zip.file('README.txt', readme(rows, now))
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip', streamFiles: true }, (m: { percent: number }) => onProgress({ stage: 'archive', percent: Math.round(m.percent) }))
  return { blob, rows }
}

export class PhotoExportTooLarge extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PhotoExportTooLarge'
  }
}

export const photoExportFilename = (now = new Date()) => `students_export_${exportDate(now)}.zip`
