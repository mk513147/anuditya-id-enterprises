import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Feedback, FeedbackInput, FeedbackStatus } from '@/types'
import { isRepositoryError } from '../errors'
import { db } from './db'
import { mockFeedbackRepository as repo } from './feedback'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const ALL = { pageSize: 100 }
const ids = (r: { items: { id: string }[] }) => r.items.map((f) => f.id)
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const publicIds = async () => (await repo.listApproved()).map((f) => f.id).sort()
const input = (over: Partial<Record<keyof FeedbackInput, unknown>> = {}) =>
  ({ name: 'Meera Joshi', organization: 'Lotus International School', rating: 5, message: 'Lovely work and very quick delivery.', ...over }) as FeedbackInput

const seed = JSON.parse(JSON.stringify(db.feedback)) as Feedback[]
beforeEach(() => {
  db.feedback.splice(0, db.feedback.length, ...(JSON.parse(JSON.stringify(seed)) as Feedback[]))
})

describe('admin feedback list', () => {
  it('lists every submission with pending first, then newest', async () => {
    const r = await repo.list(ALL)
    expect(r.total).toBe(5)
    expect(ids(r)).toEqual(['fb-4', 'fb-1', 'fb-2', 'fb-3', 'fb-5'])
  })

  it('reports counts per moderation status, independent of the filters', async () => {
    const r = await repo.list({ ...ALL, status: 'approved' })
    expect(r.total).toBe(3)
    expect(r.counts).toEqual({ total: 5, pending: 1, approved: 3, rejected: 1 })
  })

  it('filters by moderation status', async () => {
    expect(ids(await repo.list({ ...ALL, status: 'pending' }))).toEqual(['fb-4'])
    expect(ids(await repo.list({ ...ALL, status: 'rejected' }))).toEqual(['fb-5'])
    expect((await repo.list({ ...ALL, status: 'all' })).total).toBe(5)
  })

  it('filters by rating', async () => {
    expect(ids(await repo.list({ ...ALL, rating: 5 })).sort()).toEqual(['fb-1', 'fb-2'])
    expect(ids(await repo.list({ ...ALL, rating: 1 }))).toEqual(['fb-5'])
    expect((await repo.list({ ...ALL, rating: 'all' })).total).toBe(5)
  })

  it('searches by name or message, case-insensitive', async () => {
    expect(ids(await repo.list({ ...ALL, search: 'POOJA' }))).toEqual(['fb-2'])
    expect(ids(await repo.list({ ...ALL, search: 'data sheet' }))).toEqual(['fb-3'])
    expect((await repo.list({ ...ALL, search: 'zzz' })).total).toBe(0)
  })

  it('combines status, rating and search', async () => {
    expect(ids(await repo.list({ ...ALL, status: 'approved', rating: 4, search: 'amit' }))).toEqual(['fb-3'])
    expect((await repo.list({ ...ALL, status: 'pending', rating: 5 })).total).toBe(0)
  })

  it('paginates and clamps out-of-range pages', async () => {
    const first = await repo.list({ page: 1, pageSize: 2 })
    expect([first.items.length, first.totalPages]).toEqual([2, 3])
    const last = await repo.list({ page: 50, pageSize: 2 })
    expect([last.page, last.items.length]).toEqual([3, 1])
  })

  it('rejects malformed filters', async () => {
    for (const bad of [{ status: 'done' }, { rating: 0 }, { rating: 6 }, { rating: '5' }, { rating: 2.5 }]) {
      expect(isRepositoryError(await rejection(repo.list(bad as never)), 'invalid_filter'), JSON.stringify(bad)).toBe(true)
    }
  })

  it('shows only what the model holds (no invented contact details) and returns copies', async () => {
    const r = await repo.list(ALL)
    for (const f of r.items) expect(Object.keys(f).every((k) => ['id', 'name', 'organization', 'rating', 'message', 'status', 'createdAt'].includes(k))).toBe(true)
    r.items[0].status = 'approved'
    expect(JSON.stringify(db.feedback)).toBe(JSON.stringify(seed))
  })
})

describe('admin feedback detail', () => {
  it('returns one submission', async () => {
    expect(await repo.getDetail('fb-4')).toMatchObject({ name: 'Neha Kumari', status: 'pending', rating: 4 })
  })

  it('rejects a missing id (not_found) and an unusable id (invalid_id)', async () => {
    expect(isRepositoryError(await rejection(repo.getDetail('fb-99')), 'not_found')).toBe(true)
    for (const bad of ['', ' ', undefined, null, 3]) expect(isRepositoryError(await rejection(repo.getDetail(bad as never)), 'invalid_id'), String(bad)).toBe(true)
  })
})

describe('moderation', () => {
  it('approves pending feedback and returns the updated record', async () => {
    const f = await repo.setStatus('fb-4', 'approved')
    expect(f).toMatchObject({ id: 'fb-4', status: 'approved', name: 'Neha Kumari', message: 'Waiting for approval.' })
    expect(db.feedback.find((x) => x.id === 'fb-4')!.status).toBe('approved')
  })

  it('rejects pending feedback', async () => {
    expect((await repo.setStatus('fb-4', 'rejected')).status).toBe('rejected')
  })

  it('allows every decision to be changed afterwards, including back to pending', async () => {
    const order: FeedbackStatus[] = ['approved', 'rejected', 'approved', 'pending', 'rejected', 'pending']
    for (const s of order) expect((await repo.setStatus('fb-4', s)).status).toBe(s)
  })

  it('changes only the status: no other field and no other record', async () => {
    const before = JSON.parse(JSON.stringify(db.feedback)) as Feedback[]
    await repo.setStatus('fb-5', 'pending')
    const after = db.feedback
    expect(after.filter((f, i) => JSON.stringify(f) !== JSON.stringify(before[i])).map((f) => f.id)).toEqual(['fb-5'])
    expect(after.find((f) => f.id === 'fb-5')).toEqual({ ...before.find((f) => f.id === 'fb-5'), status: 'pending' })
  })

  it('rejects an unsupported status value and leaves the record untouched', async () => {
    for (const bad of ['Approved', 'done', '', null, undefined, 1, 'approved ']) {
      expect(isRepositoryError(await rejection(repo.setStatus('fb-4', bad as never)), 'invalid_status'), String(bad)).toBe(true)
    }
    expect(JSON.stringify(db.feedback)).toBe(JSON.stringify(seed))
  })

  it('rejects an unchanged status, a missing record and an unusable id', async () => {
    expect(isRepositoryError(await rejection(repo.setStatus('fb-1', 'approved')), 'no_change')).toBe(true)
    expect(isRepositoryError(await rejection(repo.setStatus('fb-99', 'approved')), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.setStatus('', 'approved')), 'invalid_id')).toBe(true)
    expect(isRepositoryError(await rejection(repo.setStatus(undefined as never, 'approved')), 'invalid_id')).toBe(true)
    expect(JSON.stringify(db.feedback)).toBe(JSON.stringify(seed))
  })

  it('validates the id before the status', async () => {
    expect(isRepositoryError(await rejection(repo.setStatus('', 'bogus' as never)), 'invalid_id')).toBe(true)
  })
})

describe('public feedback after moderation (shared store; Home reads the same list)', () => {
  it('starts with only the three approved items', async () => {
    expect(await publicIds()).toEqual(['fb-1', 'fb-2', 'fb-3'])
  })

  it('approved feedback becomes public at once', async () => {
    await repo.setStatus('fb-4', 'approved')
    expect(await publicIds()).toContain('fb-4')
    expect((await repo.listApproved()).find((f) => f.id === 'fb-4')).toMatchObject({ name: 'Neha Kumari', rating: 4 })
  })

  it('rejecting or returning to pending removes it from public again', async () => {
    await repo.setStatus('fb-1', 'rejected')
    expect(await publicIds()).not.toContain('fb-1')
    await repo.setStatus('fb-1', 'approved')
    expect(await publicIds()).toContain('fb-1')
    await repo.setStatus('fb-1', 'pending')
    expect(await publicIds()).not.toContain('fb-1')
  })

  it('pending and rejected feedback stay hidden', async () => {
    const pub = await publicIds()
    expect(pub).not.toContain('fb-4')
    expect(pub).not.toContain('fb-5')
  })

  it('a failed moderation changes nothing publicly', async () => {
    await rejection(repo.setStatus('fb-4', 'bogus' as never))
    await rejection(repo.setStatus('fb-99', 'approved'))
    expect(await publicIds()).toEqual(['fb-1', 'fb-2', 'fb-3'])
  })
})

describe('public submission (regression)', () => {
  it('always stores new feedback as pending, never public until approved', async () => {
    const r = await repo.submit(input())
    expect(r.status).toBe('pending')
    expect(db.feedback.find((f) => f.id === r.id)!.status).toBe('pending')
    expect(await publicIds()).not.toContain(r.id)
  })

  it('a new submission appears in the admin queue first, and publishes only after approval', async () => {
    const { id } = await repo.submit(input())
    expect(ids(await repo.list(ALL))[0]).toBe(id)
    expect((await repo.list({ ...ALL, status: 'pending' })).counts.pending).toBe(2)
    await repo.setStatus(id, 'approved')
    expect(await publicIds()).toContain(id)
  })

  it('still trims, still re-validates, and the "FAIL" hook still rejects', async () => {
    const r = await repo.submit(input({ name: '  Meera  ', organization: '  ', message: '  Great job overall.  ' }))
    expect(db.feedback.find((f) => f.id === r.id)).toMatchObject({ name: 'Meera', organization: undefined, message: 'Great job overall.' })
    await expect(repo.submit(input({ name: 'fail' }))).rejects.toThrow()
    await expect(repo.submit(input({ rating: 9 }))).rejects.toThrow()
    await expect(repo.submit(input({ message: '   ' }))).rejects.toThrow()
  })
})
