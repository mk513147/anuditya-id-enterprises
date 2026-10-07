import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { FeedbackInput } from '@/types'
import { mockAdvertisementRepository as ads } from './advertisements'
import { db } from './db'
import { mockFeedbackRepository as feedback } from './feedback'
import { mockOrderRepository as orders } from './orders'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const NOW = new Date('2026-10-06T12:00:00.000Z')
const titles = async (now: Date) => (await ads.listPublic(now)).map((a) => a.id).sort()

describe('order lookup (public)', () => {
  it('finds an order by its exact reference', async () => {
    const o = await orders.findByReference('JOB-2026-0003')
    expect(o).toMatchObject({ orderNo: 'JOB-2026-0003', customer: 'Sunrise Public School', service: 'School Diary', quantity: 600, status: 'Printing' })
  })

  it('is case-insensitive and tolerates surrounding or inner whitespace', async () => {
    for (const v of ['job-2026-0003', '  JOB-2026-0003  ', 'job 2026 0003']) {
      expect((await orders.findByReference(v))?.orderNo).toBe('JOB-2026-0003')
    }
  })

  it('returns null for a reference that does not exist', async () => {
    expect(await orders.findByReference('JOB-2026-9999')).toBeNull()
    expect(await orders.findByReference('ABC-0000-0000')).toBeNull()
  })

  it('NEVER returns another order for a partial, empty or malformed reference', async () => {
    for (const v of ['', '   ', 'JOB', 'JOB-2026', 'JOB-2026-000', 'JOB-2026-00033', '2026', '0003', '%%%%%', "' OR '1'='1", 'JOB-2026-0003;', 'JOB-2026-0003 extra']) {
      expect(await orders.findByReference(v), `reference ${JSON.stringify(v)}`).toBeNull()
    }
  })

  it('exposes only whitelisted fields: no id, school id or internal notes', async () => {
    const stored = db.orders.find((o) => o.orderNo === 'JOB-2026-0009')!
    expect(stored.notes).toBeTruthy() // the demo order really has an internal note…
    const o = await orders.findByReference('JOB-2026-0009')
    expect(Object.keys(o!).sort()).toEqual(['customer', 'expectedDelivery', 'orderDate', 'orderNo', 'quantity', 'service', 'status'])
    expect(JSON.stringify(o)).not.toContain('AWB') // …and it never leaves the data layer
  })

  it('returns a copy, so callers cannot mutate stored orders', async () => {
    const o = await orders.findByReference('JOB-2026-0003')
    o!.status = 'Delivered'
    expect(db.orders.find((x) => x.orderNo === 'JOB-2026-0003')!.status).toBe('Printing')
  })

  it('rejects on the documented failure reference, and nothing is changed', async () => {
    const before = JSON.stringify(db.orders)
    await expect(orders.findByReference('job-fail')).rejects.toThrow()
    expect(JSON.stringify(db.orders)).toBe(before)
  })

  it('has demo orders covering every public stage', () => {
    const seen = new Set(db.orders.map((o) => o.status))
    for (const s of ['Order Received', 'Data Verification', 'Designing', 'Printing', 'Quality Check', 'Ready', 'Dispatched', 'Delivered']) expect(seen.has(s as never)).toBe(true)
  })
})

describe('advertisement repository (public visibility)', () => {
  it('shows only enabled, published, started and unexpired advertisements', async () => {
    expect(await titles(NOW)).toEqual(['ad-diary', 'ad-lanyard', 'ad-magazine', 'ad-prospectus'])
  })

  it('hides disabled, draft, expired and not-yet-started advertisements', async () => {
    const visible = await titles(NOW)
    for (const hidden of ['ad-inactive', 'ad-draft', 'ad-expired', 'ad-scheduled']) expect(visible).not.toContain(hidden)
  })

  it('respects start and end dates as time moves', async () => {
    expect(await titles(new Date('2026-12-15T00:00:00Z'))).toEqual(['ad-diary', 'ad-lanyard', 'ad-prospectus', 'ad-scheduled']) // magazine ended, winter started
    expect(await titles(new Date('2027-01-02T00:00:00Z'))).toEqual(['ad-lanyard', 'ad-prospectus', 'ad-scheduled']) // diary ended too
    expect(await titles(new Date('2026-05-01T00:00:00Z'))).toEqual(['ad-diary', 'ad-expired', 'ad-lanyard', 'ad-magazine']) // summer drive still running; prospectus not started
    expect(await titles(new Date('2026-08-01T00:00:00Z'))).toEqual(['ad-diary', 'ad-lanyard', 'ad-magazine']) // summer drive has ended
  })

  it('returns an empty list when nothing is public (empty state)', async () => {
    const saved = db.advertisements.splice(0)
    expect(await ads.listPublic(NOW)).toEqual([])
    db.advertisements.push(...saved)
  })

  it('reflects admin changes immediately, because it reads the shared database', async () => {
    const lanyard = db.advertisements.find((a) => a.id === 'ad-lanyard')!
    lanyard.isPublished = false
    expect(await titles(NOW)).not.toContain('ad-lanyard')
    lanyard.isPublished = true
    expect(await titles(NOW)).toContain('ad-lanyard')
  })
})

describe('feedback repository', () => {
  const input = (over: Partial<FeedbackInput> = {}): FeedbackInput => ({ name: 'Asha Verma', organization: 'Demo School', rating: 5, message: 'Lovely quality and on-time delivery.', ...over })

  it('stores new feedback as PENDING approval', async () => {
    const before = db.feedback.length
    const r = await feedback.submit(input())
    expect(r.status).toBe('pending')
    expect(db.feedback).toHaveLength(before + 1)
    expect(db.feedback.find((f) => f.id === r.id)).toMatchObject({ status: 'pending', name: 'Asha Verma', organization: 'Demo School', rating: 5 })
  })

  it('does not show pending feedback publicly, but does once an admin approves it', async () => {
    const { id } = await feedback.submit(input({ name: 'Pending Person' }))
    expect((await feedback.listApproved()).some((f) => f.id === id)).toBe(false)
    db.feedback.find((f) => f.id === id)!.status = 'approved' // what the admin Approve action will do
    expect((await feedback.listApproved()).some((f) => f.id === id)).toBe(true)
  })

  it('never shows rejected feedback', async () => {
    const { id } = await feedback.submit(input({ name: 'Rejected Person' }))
    db.feedback.find((f) => f.id === id)!.status = 'rejected'
    const approved = await feedback.listApproved()
    expect(approved.some((f) => f.id === id)).toBe(false)
    expect(approved.every((f) => f.status === 'approved')).toBe(true)
  })

  it('lists approved testimonials newest first', async () => {
    const dates = (await feedback.listApproved()).map((f) => f.createdAt)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(dates.length).toBe(db.feedback.filter((f) => f.status === 'approved').length)
  })

  it('trims text and treats a blank organisation as none', async () => {
    const { id } = await feedback.submit(input({ name: '  Ravi  ', organization: '   ', message: '  Good work, thank you.  ' }))
    expect(db.feedback.find((f) => f.id === id)).toMatchObject({ name: 'Ravi', organization: undefined, message: 'Good work, thank you.' })
  })

  it('re-validates in the data layer (the form is not the only gatekeeper)', async () => {
    const before = db.feedback.length
    await expect(feedback.submit(input({ rating: 0 as never }))).rejects.toThrow()
    await expect(feedback.submit(input({ rating: 6 as never }))).rejects.toThrow()
    await expect(feedback.submit(input({ message: '   ' }))).rejects.toThrow()
    await expect(feedback.submit(input({ name: '  ' }))).rejects.toThrow()
    expect(db.feedback).toHaveLength(before)
  })

  it('fails on the documented FAIL name and stores nothing', async () => {
    const before = db.feedback.length
    await expect(feedback.submit(input({ name: 'fail' }))).rejects.toThrow('Mock feedback failure')
    expect(db.feedback).toHaveLength(before)
  })

  it('a failed submission can be retried successfully (mutation lifecycle, as the UI drives it)', async () => {
    const observer = new MutationObserver(new QueryClient(), { mutationFn: (i: FeedbackInput) => feedback.submit(i) })
    const before = db.feedback.length

    await expect(observer.mutate(input({ name: 'FAIL' }))).rejects.toThrow()
    expect(observer.getCurrentResult().isError).toBe(true)
    expect(db.feedback).toHaveLength(before) // nothing was stored by the failed attempt

    const ok = await observer.mutate(input({ name: 'Retry Person' })) // the retry
    expect(ok.status).toBe('pending')
    expect(observer.getCurrentResult().isSuccess).toBe(true)
    expect(db.feedback).toHaveLength(before + 1) // exactly one record, no duplicates
  })
})
