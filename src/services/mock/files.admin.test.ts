import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadedFile } from '@/types'
import { isRepositoryError } from '../errors'
import { mockDashboardRepository as dashboard } from './dashboard'
import { db } from './db'
import { MOCK_FAILURE_FILENAME_TOKEN, mockFileRepository as repo } from './files'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const ALL = { pageSize: 100 }
const names = (r: { items: { originalName: string }[] }) => r.items.map((f) => f.originalName)
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const sheet = (name: string, body = 'a,b\n1,2\n') => new File([body], name, { type: 'text/csv' })

// Every test starts from the seeded files: drop anything an earlier test uploaded.
const seed = JSON.parse(JSON.stringify(db.files)) as UploadedFile[]
beforeEach(() => {
  db.files.splice(0, db.files.length, ...(JSON.parse(JSON.stringify(seed)) as UploadedFile[]))
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
    expect(r.counts).toEqual({ total: 4, totalBytes: 254_976 + 48_120 + 122_880 + 98_304, byType: { xlsx: 2, xls: 1, csv: 1 } })
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
    await repo.upload(sheet('public-upload.csv'), { onProgress: () => {} })
    expect(names(await repo.list({ ...ALL, schoolId: 'none' }))).toEqual(['public-upload.csv'])
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
      uploadedAt: '2026-09-04T09:05:00.000Z', schoolId: 'sch-sunrise', schoolName: 'Sunrise Public School',
    })
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

describe('public upload flow (regression)', () => {
  it('stores METADATA ONLY: name, type, size and time, with no school and no file bytes', async () => {
    const before = db.files.length
    const progress: number[] = []
    const result = await repo.upload(sheet('Class9.csv', 'name,roll\nA,1\n'), { onProgress: (p) => progress.push(p) })
    expect(db.files).toHaveLength(before + 1)
    const stored = db.files.at(-1)!
    expect(Object.keys(stored).sort()).toEqual(['id', 'originalName', 'referenceNo', 'sizeBytes', 'storagePath', 'type', 'uploadedAt'])
    expect(stored.schoolId).toBeUndefined()
    expect(stored.sizeBytes).toBe(14)
    expect(JSON.stringify(stored)).not.toContain('name,roll') // the contents are not kept anywhere
    expect(result).toEqual({ referenceNo: stored.referenceNo, originalName: 'Class9.csv', type: 'csv', sizeBytes: 14, uploadedAt: stored.uploadedAt })
  })

  it('reports progress up to 100 and gives the public result no storage details', async () => {
    const progress: number[] = []
    const result = await repo.upload(sheet('a.csv'), { onProgress: (p) => progress.push(p) })
    expect(progress[0]).toBe(0)
    expect(progress.at(-1)).toBe(100)
    expect(progress).toEqual([...progress].sort((a, b) => a - b))
    expect(JSON.stringify(result)).not.toMatch(/storagePath|uploads\//)
  })

  it('numbers references sequentially', async () => {
    const a = await repo.upload(sheet('a.csv'), { onProgress: () => {} })
    const b = await repo.upload(sheet('b.csv'), { onProgress: () => {} })
    expect(a.referenceNo).toBe(`FILE-${new Date().getFullYear()}-00005`)
    expect(b.referenceNo).toBe(`FILE-${new Date().getFullYear()}-00006`)
  })

  it('a failing upload rejects and stores nothing', async () => {
    const before = JSON.stringify(db.files)
    await expect(repo.upload(sheet(`x-${MOCK_FAILURE_FILENAME_TOKEN}.csv`), { onProgress: () => {} })).rejects.toThrow()
    expect(JSON.stringify(db.files)).toBe(before)
  })

  it('a new upload appears in the admin list and in the dashboard count', async () => {
    await repo.upload(sheet('fresh.xlsx'), { onProgress: () => {} })
    const r = await repo.list({ ...ALL, search: 'fresh' })
    expect(r.items).toHaveLength(1)
    expect(r.items[0].schoolName).toBeUndefined()
    expect((await dashboard.get()).counts.uploadedFiles).toBe(5)
  })
})
