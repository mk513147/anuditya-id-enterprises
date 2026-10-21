import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { forEachLimit } from '@/lib/concurrency'
import type { AdminStudent, StudentPhotoResult } from '@/services/types'
import type { ID } from '@/types'
import {
  buildStudentPhotoExport, PHOTO_EXPORT_MAX_STUDENTS, photoExportFilename, PhotoExportTooLarge, photoFileName, readme,
} from './studentPhotoExport'

const JPEG = (tag: number) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, tag, tag, tag, 0xd9])], { type: 'image/jpeg' })
const PNG = (tag: number) => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, tag])], { type: 'image/png' })
const SVG = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], { type: 'image/jpeg' })

const student = (n: number, over: Partial<AdminStudent> = {}): AdminStudent => ({
  id: `${String(n).padStart(8, '0')}-aaaa-4bbb-8ccc-${String(n).padStart(12, '0')}`, referenceNo: `ANU-2026-${String(n).padStart(5, '0')}`,
  schoolId: 'sch-1', name: `Student ${n}`, fatherName: 'F', motherName: 'M', dob: '2012-01-01', className: 'Class 6', section: 'A', rollNo: String(n),
  admissionNo: `ADM-${n}`, address: 'Addr', mobile: '9000000001', submittedAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', isArchived: false,
  approvalStatus: 'approved', schoolName: 'School', schoolCode: 'S-1', schoolActive: true, ...over,
})

/** A fake repository downloadPhotos: answers in REVERSE order (to prove the mapping does not depend on order). */
const fakeDownload = (answers: Record<ID, StudentPhotoResult>, extra?: (onPhoto: (id: ID, r: StudentPhotoResult) => void) => void) =>
  async (ids: ID[], o: { concurrency: number; onPhoto: (id: ID, r: StudentPhotoResult) => void }) => {
    extra?.(o.onPhoto)
    for (const id of [...ids].reverse()) o.onPhoto(id, answers[id] ?? { status: 'missing' })
  }

async function unpack(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await zip.file('students.xlsx')!.async('uint8array')) as unknown as ArrayBuffer)
  const ws = wb.getWorksheet('Students')!
  const headers = (ws.getRow(1).values as string[]).slice(1)
  const rows = Array.from({ length: ws.rowCount - 1 }, (_, i) => Object.fromEntries(headers.map((h, c) => [h, ws.getRow(i + 2).getCell(c + 1).value])))
  return { zip, rows, headers, xml: (await JSZip.loadAsync(await zip.file('students.xlsx')!.async('uint8array'))) }
}

describe('students with photos: archive', () => {
  const s1 = student(1), s2 = student(2), s3 = student(3), s4 = student(4), s5 = student(5)
  const answers: Record<ID, StudentPhotoResult> = {
    [s1.id]: { status: 'ok', blob: JPEG(1) },
    [s2.id]: { status: 'ok', blob: PNG(2) },
    [s3.id]: { status: 'missing' },
    [s4.id]: { status: 'failed' },
    [s5.id]: { status: 'ok', blob: SVG }, // stored as "image/jpeg" but is not an image: never included
  }

  it('contains exactly students.xlsx, README.txt and one photo per student that has one', async () => {
    const { blob } = await buildStudentPhotoExport([s1, s2, s3, s4, s5], fakeDownload(answers))
    expect(blob.type).toBe('application/zip')
    const { zip } = await unpack(blob)
    const files = Object.values(zip.files).filter((f) => !f.dir).map((f) => f.name).sort()
    expect(files).toEqual(['README.txt', 'student_photos/ANU-2026-00001_00000001.jpg', 'student_photos/ANU-2026-00002_00000002.png', 'students.xlsx'])
  })

  it('maps every row to exactly its own photo (by bytes), and keeps students without one', async () => {
    const { blob } = await buildStudentPhotoExport([s1, s2, s3, s4, s5], fakeDownload(answers))
    const { zip, rows } = await unpack(blob)
    expect(rows.map((r) => r['Reference No'])).toEqual([s1, s2, s3, s4, s5].map((s) => s.referenceNo)) // list order, nobody dropped
    expect(rows.map((r) => r['Photo status'])).toEqual(['Included', 'Included', 'No photo on record', 'Download failed', 'Download failed'])
    expect(rows.map((r) => r['Photo file'])).toEqual(['student_photos/ANU-2026-00001_00000001.jpg', 'student_photos/ANU-2026-00002_00000002.png', null, null, null])
    const b1 = await zip.file('student_photos/ANU-2026-00001_00000001.jpg')!.async('uint8array')
    const b2 = await zip.file('student_photos/ANU-2026-00002_00000002.png')!.async('uint8array')
    expect(b1[4]).toBe(1) // student 1's bytes in student 1's file
    expect(b2[8]).toBe(2)
  })

  it('ignores photos for students that were not requested, and a second answer for the same student', async () => {
    const intruder = { status: 'ok' as const, blob: JPEG(9) }
    const { blob } = await buildStudentPhotoExport([s1], fakeDownload({ [s1.id]: { status: 'ok', blob: JPEG(1) } }, (onPhoto) => {
      onPhoto('ffffffff-ffff-4fff-8fff-ffffffffffff', intruder)
      onPhoto(s1.id, { status: 'ok', blob: JPEG(7) })
    }))
    const { zip } = await unpack(blob)
    expect(Object.keys(zip.files).filter((f) => f.startsWith('student_photos/') && !f.endsWith('/'))).toEqual(['student_photos/ANU-2026-00001_00000001.jpg'])
    expect((await zip.file('student_photos/ANU-2026-00001_00000001.jpg')!.async('uint8array'))[4]).toBe(7) // the first answer for s1 won
  })

  it('the workbook has the student columns plus Photo file and Photo status, and no links, paths or ids', async () => {
    const { blob } = await buildStudentPhotoExport([s1, s3], fakeDownload(answers))
    const { headers, xml, rows } = await unpack(blob)
    expect(headers.slice(-2)).toEqual(['Photo file', 'Photo status'])
    // Every cell value: no signed links, object URLs, storage paths or internal ids.
    expect(JSON.stringify(rows)).not.toMatch(/https?:|blob:|token|submissions\/|aaaa-4bbb/)
    expect(await xml.file('xl/worksheets/sheet1.xml')!.async('string')).not.toMatch(/<f[ >]/)
  })

  it('writes a README with the counts and naming rule, but no personal details', async () => {
    const { blob } = await buildStudentPhotoExport([s1, s2, s3, s4], fakeDownload(answers), { now: new Date('2026-10-21T08:00:00Z') })
    const { zip } = await unpack(blob)
    const text = await zip.file('README.txt')!.async('string')
    expect(text).toContain('Exported: 2026-10-21')
    expect(text).toContain('Students: 4')
    expect(text).toContain('Photographs included: 2')
    expect(text).toContain('No photograph on record: 1')
    expect(text).toContain('Photograph download failed: 1')
    expect(text).toContain('student_photos/<Reference No>_<first 8 characters of the internal student id>.<jpg|png>')
    expect(text).not.toContain('Student 1')
    expect(readme([], new Date())).toContain('Students: 0')
  })

  it('reports progress for the photo and archive stages', async () => {
    const stages: string[] = []
    await buildStudentPhotoExport([s1, s2], fakeDownload(answers), { onProgress: (p) => stages.push(p.stage === 'photos' ? `photos ${p.done}/${p.total}` : 'archive') })
    expect(stages.slice(0, 3)).toEqual(['photos 0/2', 'photos 1/2', 'photos 2/2'])
    expect(stages.at(-1)).toBe('archive')
  })
})

describe('students with photos: safety limits', () => {
  it('sanitises file names: only letters, digits and hyphens from the reference, plus an id suffix', () => {
    expect(photoFileName({ id: '8F31C2AA-0000-4000-8000-000000000000', referenceNo: '../ANU 2026/<x>' }, 'jpg')).toBe('..ANU2026x_8f31c2aa.jpg'.replace('..', ''))
    expect(photoFileName({ id: '', referenceNo: '' }, 'png')).toBe('student_00000000.png')
    expect(photoFileName({ id: 'abc', referenceNo: 'ANU-2026-00001' }, 'jpg')).toBe('ANU-2026-00001_abc.jpg')
  })

  it('refuses more students than the browser export allows', async () => {
    const many = Array.from({ length: PHOTO_EXPORT_MAX_STUDENTS + 1 }, (_, i) => student(i + 1))
    await expect(buildStudentPhotoExport(many, fakeDownload({}))).rejects.toBeInstanceOf(PhotoExportTooLarge)
  })

  it('refuses when the photographs exceed the size budget, instead of exhausting memory', async () => {
    const s = student(1)
    await expect(buildStudentPhotoExport([s], fakeDownload({ [s.id]: { status: 'ok', blob: JPEG(1) } }), { maxBytes: 4 })).rejects.toBeInstanceOf(PhotoExportTooLarge)
  })

  it('stops when cancelled', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(buildStudentPhotoExport([student(1)], fakeDownload({}), { signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('names the archive by type and date', () => {
    expect(photoExportFilename(new Date('2026-10-21T08:00:00Z'))).toBe('students_export_2026-10-21.zip')
  })
})

describe('bounded concurrency', () => {
  it('never runs more than the limit at once, and runs every item', async () => {
    let inFlight = 0, peak = 0
    const seen: number[] = []
    await forEachLimit(Array.from({ length: 23 }, (_, i) => i), 4, async (n) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1 + (n % 3)))
      seen.push(n)
      inFlight--
    })
    expect(peak).toBe(4)
    expect(seen.sort((a, b) => a - b)).toEqual(Array.from({ length: 23 }, (_, i) => i))
  })

  it('starts nothing new after an abort', async () => {
    const ctrl = new AbortController()
    const started: number[] = []
    await forEachLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      started.push(n)
      if (n === 2) ctrl.abort()
      await new Promise((r) => setTimeout(r, 1))
    }, ctrl.signal)
    expect(started).toEqual([1, 2])
  })
})
