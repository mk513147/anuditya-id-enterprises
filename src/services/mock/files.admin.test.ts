import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SchoolFileSubmission, UploadedFile } from '@/types'
import { isRepositoryError } from '../errors'
import { mockDashboardRepository as dashboard } from './dashboard'
import { db } from './db'
import { MOCK_FAILURE_FILENAME_TOKEN, mockFileRepository as repo } from './files'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const ALL = { pageSize: 100 }
const names = (r: { items: { originalName: string }[] }) => r.items.map((f) => f.originalName)
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
/** A file whose first bytes match its extension (the repository checks them), like a real spreadsheet would. */
const sheet = (name: string, body = 'a,b\n1,2\n') => {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const head = ext === 'xlsx' ? [0x50, 0x4b, 0x03, 0x04] : ext === 'xls' ? [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] : []
  return new File([new Uint8Array(head), body], name, { type: ext === 'csv' ? 'text/csv' : '' })
}
const VALID: Omit<SchoolFileSubmission, 'file'> = {
  schoolId: 'sch-lotus', contactPerson: '  Asha Teacher ', contactDetails: '+91 90000 00001', category: 'student_data',
  description: 'Student list for the 2026-27 session, Class 10, for ID card printing.',
}
const submit = (name: string, over: Partial<SchoolFileSubmission> = {}, body?: string, onProgress: (p: number) => void = () => {}) =>
  repo.submit({ ...VALID, file: sheet(name, body), ...over }, { onProgress })

// Every test starts from the seeded files: drop anything an earlier test uploaded.
const seed = JSON.parse(JSON.stringify(db.files)) as UploadedFile[]
beforeEach(() => {
  db.files.splice(0, db.files.length, ...(JSON.parse(JSON.stringify(seed)) as UploadedFile[]))
  db.fileReviews.length = 0
})

describe('admin file list', () => {
  it('lists every stored record, newest upload first, with real metadata only', async () => {
    const r = await repo.list(ALL)
    expect(r.total).toBe(db.files.length)
    const times = r.items.map((f) => f.uploadedAt)
    expect(times).toEqual([...times].sort().reverse())
    const first = r.items.find((f) => f.referenceNo === 'FILE-2026-00001')!
    expect(first).toMatchObject({ originalName: 'StMarys_Students_2026.xlsx', type: 'xlsx', sizeBytes: 254_976, uploadedAt: '2026-06-09T10:15:00.000Z', schoolName: "St. Mary's School" })
  })

  it('never exposes the private storage path (or the raw customer field) to the admin UI', async () => {
    const r = await repo.list(ALL)
    for (const f of r.items) {
      expect(Object.keys(f)).not.toContain('storagePath')
      expect(Object.keys(f)).not.toContain('customer')
    }
    expect(JSON.stringify(r)).not.toContain('uploads/2026/')
    expect(JSON.stringify(await repo.getDetail('fil-1'))).not.toContain('uploads/2026/')
  })

  it('reports overall counts, total size and counts per type, independent of the filters', async () => {
    const r = await repo.list({ ...ALL, type: 'csv' })
    expect(r.total).toBe(1)
    expect(r.counts).toEqual({
      total: 4, totalBytes: 254_976 + 48_120 + 122_880 + 98_304, byType: { xlsx: 2, xls: 1, csv: 1 },
      byReview: { pending: 1, approved: 2, rejected: 0, corrections_required: 1 },
    })
  })

  it('searches by file name or reference, case-insensitive and partial', async () => {
    expect(names(await repo.list({ ...ALL, search: 'sunrise' }))).toEqual(['Sunrise_List.xls'])
    expect(names(await repo.list({ ...ALL, search: 'BATCH' }))).toEqual(['GreenValley_Batch_A.csv'])
    expect(names(await repo.list({ ...ALL, search: 'file-2026-00004' }))).toEqual(['Lotus_Class8.xlsx'])
    expect((await repo.list({ ...ALL, search: 'nothing-like-this' })).total).toBe(0)
  })

  it('filters by type', async () => {
    expect((await repo.list({ ...ALL, type: 'xlsx' })).total).toBe(2)
    expect((await repo.list({ ...ALL, type: 'xls' })).total).toBe(1)
    expect((await repo.list({ ...ALL, type: 'all' })).total).toBe(4)
  })

  it('filters by school, including files with no school recorded', async () => {
    expect(names(await repo.list({ ...ALL, schoolId: 'sch-lotus' }))).toEqual(['Lotus_Class8.xlsx'])
    expect((await repo.list({ ...ALL, schoolId: 'none' })).total).toBe(0)
    await submit('public-upload.csv')
    expect(names(await repo.list({ ...ALL, schoolId: 'sch-lotus' }))).toEqual(['public-upload.csv', 'Lotus_Class8.xlsx'])
    expect((await repo.list({ ...ALL, schoolId: 'none' })).total).toBe(0)
  })

  it('filters by review status, and rejects an unknown one', async () => {
    expect(names(await repo.list({ ...ALL, reviewStatus: 'pending' }))).toEqual(['Lotus_Class8.xlsx'])
    expect(names(await repo.list({ ...ALL, reviewStatus: 'corrections_required' }))).toEqual(['Sunrise_List.xls'])
    expect(isRepositoryError(await rejection(repo.list({ reviewStatus: 'maybe' as never })), 'invalid_filter')).toBe(true)
  })

  it('filters by an inclusive upload-date range (local calendar days)', async () => {
    expect((await repo.list({ ...ALL, from: '2026-09-01' })).total).toBe(2)
    expect(names(await repo.list({ ...ALL, to: '2026-06-30' }))).toEqual(expect.arrayContaining(['StMarys_Students_2026.xlsx', 'GreenValley_Batch_A.csv']))
    expect((await repo.list({ ...ALL, from: '2027-01-01' })).total).toBe(0)
  })

  it('combines filters', async () => {
    expect(names(await repo.list({ ...ALL, type: 'xlsx', from: '2026-09-01' }))).toEqual(['Lotus_Class8.xlsx'])
  })

  it('paginates and clamps out-of-range pages', async () => {
    const first = await repo.list({ page: 1, pageSize: 3 })
    expect([first.items.length, first.totalPages]).toEqual([3, 2])
    const last = await repo.list({ page: 50, pageSize: 3 })
    expect([last.page, last.items.length]).toEqual([2, 1])
    expect(new Set([...names(first), ...names(last)]).size).toBe(4)
  })

  it('validates filters in the data layer', async () => {
    for (const bad of [{ type: 'pdf' }, { type: 'XLSX' }, { from: 'yesterday' }, { to: '2026-13-45' }, { from: '2026-10-02', to: '2026-10-01' }]) {
      expect(isRepositoryError(await rejection(repo.list(bad as never)), 'invalid_filter'), JSON.stringify(bad)).toBe(true)
    }
  })

  it('returns detached copies', async () => {
    const r = await repo.list(ALL)
    r.items[0].originalName = 'hacked'
    expect(JSON.stringify(db.files)).toBe(JSON.stringify(seed))
  })
})

describe('admin file detail', () => {
  it('returns one record with its school', async () => {
    expect(await repo.getDetail('fil-3')).toEqual({
      id: 'fil-3', referenceNo: 'FILE-2026-00003', originalName: 'Sunrise_List.xls', type: 'xls', sizeBytes: 122_880,
      uploadedAt: '2026-09-04T09:05:00.000Z', schoolId: 'sch-sunrise', schoolName: 'Sunrise Public School', storageState: 'metadata_only',
      contactPerson: 'Demo Class Teacher', contactDetails: '9000000031', category: 'data_corrections',
      description: 'Corrected roll numbers for Class 5 A and 5 B, replacing the list sent in August.', instructions: 'Please reprint only the changed cards.',
      reviewStatus: 'corrections_required', reviewNotes: 'Class 5 B is missing admission numbers.', reviewedAt: '2026-09-05T10:00:00.000Z', reviewHistory: [],
    })
  })

  it('offers no download for a metadata-only record', async () => {
    expect(isRepositoryError(await repo.getDownloadUrl('fil-3').then(() => null, (e: unknown) => e), 'not_stored')).toBe(true)
    expect(isRepositoryError(await repo.getDownloadUrl('nope').then(() => null, (e: unknown) => e), 'not_found')).toBe(true)
  })

  it('uses the school’s current name', async () => {
    const school = db.schools.find((s) => s.id === 'sch-sunrise')!
    const original = school.name
    school.name = 'Sunrise Renamed'
    try {
      expect((await repo.getDetail('fil-3')).schoolName).toBe('Sunrise Renamed')
    } finally {
      school.name = original
    }
  })

  it('rejects a missing record with not_found and a bad id with invalid_id', async () => {
    expect(isRepositoryError(await rejection(repo.getDetail('fil-999')), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.getDetail('FILE-2026-00001')), 'not_found')).toBe(true)
    for (const bad of ['', '  ', undefined, null, 7]) {
      expect(isRepositoryError(await rejection(repo.getDetail(bad as never)), 'invalid_id'), String(bad)).toBe(true)
    }
  })
})

describe('public submission', () => {
  it('stores the submission with its school, normalised contact details, and PENDING review', async () => {
    const before = db.files.length
    const result = await submit('Class9.csv', { instructions: '  Needed by Friday  ' }, 'name,roll\nA,1\n')
    expect(db.files).toHaveLength(before + 1)
    const stored = db.files.at(-1)!
    expect(stored).toMatchObject({
      schoolId: 'sch-lotus', contactPerson: 'Asha Teacher', contactDetails: '9000000001', category: 'student_data',
      description: VALID.description, instructions: 'Needed by Friday', reviewStatus: 'pending', storageState: 'metadata_only', sizeBytes: 14,
    })
    expect(stored.reviewedAt).toBeUndefined()
    expect(JSON.stringify(stored)).not.toContain('name,roll') // the contents are not kept anywhere
    expect(result).toEqual({ referenceNo: stored.referenceNo, originalName: 'Class9.csv', type: 'csv', sizeBytes: 14, uploadedAt: stored.uploadedAt, schoolName: 'Lotus International School' })
  })

  it('gives the public result no contact details, description, review state or storage path', async () => {
    const result = await submit('a.csv')
    expect(Object.keys(result).sort()).toEqual(['originalName', 'referenceNo', 'schoolName', 'sizeBytes', 'type', 'uploadedAt'])
    expect(JSON.stringify(result)).not.toMatch(/storagePath|incoming\/|9000000001|Asha|pending/)
  })

  it('accepts instructions that are omitted or explicitly undefined (as the form sends an empty box)', async () => {
    await expect(submit('u.csv', { instructions: undefined })).resolves.toMatchObject({ originalName: 'u.csv' })
    expect(db.files.at(-1)!.instructions).toBeUndefined()
  })

  it('stores empty optional instructions as absent, and lower-cases an email', async () => {
    await submit('b.csv', { instructions: '   ', contactDetails: 'Office@Example.INVALID' })
    expect(db.files.at(-1)).toMatchObject({ instructions: undefined, contactDetails: 'office@example.invalid' })
  })

  it.each([
    ['schoolId', { schoolId: '' }],
    ['contactPerson', { contactPerson: '   ' }],
    ['contactPerson', { contactPerson: '<script>' }],
    ['contactDetails', { contactDetails: '' }],
    ['contactDetails', { contactDetails: '12345' }],
    ['contactDetails', { contactDetails: 'a@b' }],
    ['category', { category: 'approved' as never }],
    ['description', { description: '   too short   ' }],
    ['description', { description: 'x'.repeat(1001) }],
    ['instructions', { instructions: 'x'.repeat(1001) }],
  ] as const)('refuses an invalid %s and stores nothing', async (field, over) => {
    const before = db.files.length
    const e = await rejection(submit('c.csv', over))
    expect(isRepositoryError(e, 'invalid_input')).toBe(true)
    expect(Object.keys((e as { fieldErrors: object }).fieldErrors)).toContain(field)
    expect(db.files).toHaveLength(before)
  })

  it.each([
    ['an unsupported extension', new File(['x'], 'list.pdf', { type: 'application/pdf' })],
    ['an empty file', new File([], 'empty.csv', { type: 'text/csv' })],
    ['a file over 10 MB', new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.csv', { type: 'text/csv' })],
    ['an .xlsx that is not a workbook', new File(['not a zip'], 'fake.xlsx')],
    ['an .xls that is not a workbook', new File(['<html>'], 'fake.xls')],
    ['a .csv with binary content', new File([new Uint8Array([0x41, 0, 0x42])], 'binary.csv', { type: 'text/csv' })],
  ])('refuses %s before anything is stored', async (_label, file) => {
    const before = db.files.length
    const e = await rejection(repo.submit({ ...VALID, file }, { onProgress: () => {} }))
    expect(isRepositoryError(e, 'invalid_input')).toBe(true)
    expect(Object.keys((e as { fieldErrors: object }).fieldErrors)).toEqual(['file'])
    expect(db.files).toHaveLength(before)
  })

  it('refuses an inactive or unknown school', async () => {
    const inactive = db.schools.find((x) => !x.isActive)!
    expect(isRepositoryError(await rejection(submit('d.csv', { schoolId: inactive.id })), 'school_unavailable')).toBe(true)
    expect(isRepositoryError(await rejection(submit('d.csv', { schoolId: 'sch-nope' })), 'school_unavailable')).toBe(true)
  })

  it('reports progress up to 100', async () => {
    const progress: number[] = []
    await submit('a.csv', {}, undefined, (p) => progress.push(p))
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(100)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
  })

  it('numbers references sequentially', async () => {
    const a = await submit('a.csv')
    const b = await submit('b.xlsx')
    expect(a.referenceNo).toBe(`FILE-${new Date().getFullYear()}-00005`)
    expect(b.referenceNo).toBe(`FILE-${new Date().getFullYear()}-00006`)
  })

  it('a failing upload rejects and stores nothing', async () => {
    const before = JSON.stringify(db.files)
    await expect(submit(`x-${MOCK_FAILURE_FILENAME_TOKEN}.csv`)).rejects.toThrow()
    expect(JSON.stringify(db.files)).toBe(before)
  })

  it('a new submission appears in the admin list and in the dashboard counts', async () => {
    const before = await dashboard.getCounts()
    await submit('fresh.xlsx')
    const r = await repo.list({ ...ALL, search: 'fresh' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({ schoolName: 'Lotus International School', reviewStatus: 'pending', contactPerson: 'Asha Teacher' })
    const after = await dashboard.getCounts()
    expect(after.uploadedFiles).toBe(5)
    expect(after.pendingFileReviews).toBe(before.pendingFileReviews + 1)
  })
})

describe('administrator review', () => {
  it('approves with notes, records the time and keeps a history', async () => {
    const d = await repo.review('fil-4', 'approved', '  Looks good  ')
    expect(d).toMatchObject({ reviewStatus: 'approved', reviewNotes: 'Looks good' })
    expect(d.reviewedAt).toBeTruthy()
    expect(d.reviewHistory).toEqual([{ status: 'approved', notes: 'Looks good', at: d.reviewedAt }])
  })

  it('can request corrections, reject, update notes only, and go back to pending', async () => {
    expect((await repo.review('fil-4', 'corrections_required', 'Class 10 B missing')).reviewStatus).toBe('corrections_required')
    expect((await repo.review('fil-4', 'corrections_required', 'Class 10 B and C missing')).reviewNotes).toBe('Class 10 B and C missing')
    expect((await repo.review('fil-4', 'rejected')).reviewNotes).toBeUndefined()
    const back = await repo.review('fil-4', 'pending', '')
    expect(back.reviewedAt).toBeUndefined()
    expect(back.reviewHistory.map((h) => h.status)).toEqual(['corrections_required', 'corrections_required', 'rejected', 'pending'])
  })

  it('refuses no-change, unknown decisions, long notes and unknown files', async () => {
    expect(isRepositoryError(await rejection(repo.review('fil-4', 'pending')), 'no_change')).toBe(true)
    expect(isRepositoryError(await rejection(repo.review('fil-4', 'maybe' as never)), 'invalid_status')).toBe(true)
    expect(isRepositoryError(await rejection(repo.review('fil-4', 'approved', 'x'.repeat(1001))), 'invalid_input')).toBe(true)
    expect(isRepositoryError(await rejection(repo.review('fil-404', 'approved')), 'not_found')).toBe(true)
    expect(db.files.find((f) => f.id === 'fil-4')!.reviewStatus).toBe('pending')
  })
})
