import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isRepositoryError } from '../errors'
import { buildTimeline } from '@/features/orders/timeline'
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/types'
import { mockDashboardRepository as dashboard } from './dashboard'
import { db } from './db'
import { mockOrderRepository as repo } from './orders'
import { mockSchoolRepository as schools } from './schools'
import { mockStudentRepository as students } from './students'

vi.mock('@/lib/delay', () => ({ delay: () => Promise.resolve() }))

const ALL = { pageSize: 100 }
const idOf = (ref: string) => db.orders.find((o) => o.orderNo === ref)!.id
const refs = (r: { items: { orderNo: string }[] }) => r.items.map((o) => o.orderNo)
const rejection = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

// Every test starts from the seeded orders: undo any status changes the previous test made.
const seed = JSON.parse(JSON.stringify(db.orders)) as Order[]
beforeEach(() => {
  db.orders.splice(0, db.orders.length, ...(JSON.parse(JSON.stringify(seed)) as Order[]))
})

describe('admin order list', () => {
  it('lists every order, newest order date first, joined to its school by id', async () => {
    const r = await repo.list(ALL)
    expect(r.total).toBe(db.orders.length)
    const dates = r.items.map((o) => o.orderDate)
    expect(dates).toEqual([...dates].sort().reverse())
    for (const o of r.items) {
      const school = db.schools.find((s) => s.id === o.schoolId)!
      expect([o.schoolName, o.schoolCode]).toEqual([school.name, school.code])
    }
  })

  it('reports overall counts per status, independent of the filters', async () => {
    const r = await repo.list({ ...ALL, status: 'Printing' })
    expect(r.total).toBe(1)
    expect(r.counts.total).toBe(db.orders.length)
    expect(Object.values(r.counts.byStatus).reduce((a, b) => a + b, 0)).toBe(db.orders.length)
    expect(Object.keys(r.counts.byStatus).sort()).toEqual([...ORDER_STATUSES].sort())
  })

  it('searches by order reference (case-insensitive, partial, whitespace tolerant)', async () => {
    expect(refs(await repo.list({ ...ALL, search: 'job-2026-0003' }))).toEqual(['JOB-2026-0003'])
    expect(refs(await repo.list({ ...ALL, search: '0003' }))).toEqual(['JOB-2026-0003'])
    expect(refs(await repo.list({ ...ALL, search: 'job 2026 0003' }))).toEqual(['JOB-2026-0003'])
  })

  it('searches by school name, using the school’s current name', async () => {
    const lotus = await repo.list({ ...ALL, search: 'lotus' })
    expect(refs(lotus).sort()).toEqual(['JOB-2026-0005', 'JOB-2026-0007'])
    const lotus0 = db.schools.find((s) => s.id === 'sch-lotus')!
    const original = { ...lotus0 }
    try {
      await schools.update('sch-lotus', { ...lotus0, name: 'Lotus Renamed Academy' })
      expect(refs(await repo.list({ ...ALL, search: 'renamed' })).sort()).toEqual(['JOB-2026-0005', 'JOB-2026-0007'])
      expect((await repo.list({ ...ALL, search: 'international' })).total).toBe(0)
    } finally {
      await schools.update('sch-lotus', original)
    }
  })

  it('returns nothing (not everything) for a search that matches nothing or is only punctuation', async () => {
    expect((await repo.list({ ...ALL, search: 'zzzz-not-an-order' })).total).toBe(0)
    expect((await repo.list({ ...ALL, search: '---' })).total).toBe(0)
  })

  it('filters by status', async () => {
    for (const s of ORDER_STATUSES) {
      const r = await repo.list({ ...ALL, status: s })
      expect(r.items.every((o) => o.status === s)).toBe(true)
      expect(r.total).toBe(db.orders.filter((o) => o.status === s).length)
    }
    expect((await repo.list({ ...ALL, status: 'all' })).total).toBe(db.orders.length)
  })

  it('filters by an inclusive order-date range', async () => {
    expect(refs(await repo.list({ ...ALL, from: '2026-09-20', to: '2026-09-28' })).sort()).toEqual(['JOB-2026-0005', 'JOB-2026-0006', 'JOB-2026-0008'])
    expect(refs(await repo.list({ ...ALL, from: '2026-10-02' }))).toEqual(['JOB-2026-0007'])
    expect(refs(await repo.list({ ...ALL, to: '2026-06-10' }))).toEqual(['JOB-2026-0001'])
    expect((await repo.list({ ...ALL, from: '2027-01-01' })).total).toBe(0)
  })

  it('combines search, status and date filters', async () => {
    const r = await repo.list({ ...ALL, search: 'st. mary', status: 'Dispatched', from: '2026-08-01' })
    expect(refs(r)).toEqual(['JOB-2026-0009'])
  })

  it('paginates and clamps out-of-range pages', async () => {
    const first = await repo.list({ page: 1, pageSize: 4 })
    expect([first.items.length, first.totalPages, first.page]).toEqual([4, Math.ceil(db.orders.length / 4), 1])
    const last = await repo.list({ page: 99, pageSize: 4 })
    expect(last.page).toBe(last.totalPages)
    expect(last.items.length).toBe(db.orders.length - 4 * (last.totalPages - 1))
    const seen = new Set([...refs(first), ...refs(await repo.list({ page: 2, pageSize: 4 })), ...refs(last)])
    expect(seen.size).toBe(db.orders.length)
  })

  it('returns detached copies, so callers cannot mutate stored orders', async () => {
    const r = await repo.list(ALL)
    r.items[0].status = 'Delivered'
    r.items[0].statusHistory = [{ status: 'Delivered', at: 'x' }]
    expect(JSON.stringify(db.orders)).toBe(JSON.stringify(seed))
  })
})

describe('admin order detail', () => {
  it('returns the full order with its school', async () => {
    const o = await repo.getDetail(idOf('JOB-2026-0009'))
    expect(o).toMatchObject({ orderNo: 'JOB-2026-0009', status: 'Dispatched', schoolName: "St. Mary's School", service: 'Group Photo', quantity: 120 })
    expect(o.notes).toBeTruthy()
  })

  it('rejects a missing order with not_found', async () => {
    expect(isRepositoryError(await rejection(repo.getDetail('ord-does-not-exist')), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.getDetail('JOB-2026-0003')), 'not_found')).toBe(true) // a reference is not an id
  })

  it('rejects an empty or non-string id with invalid_id', async () => {
    for (const bad of ['', '   ', undefined, null, 42]) {
      expect(isRepositoryError(await rejection(repo.getDetail(bad as never)), 'invalid_id'), String(bad)).toBe(true)
    }
  })
})

describe('admin status updates', () => {
  it('changes the status, records history and a timestamp, and returns the updated order', async () => {
    const id = idOf('JOB-2026-0007')
    const before = Date.now()
    const o = await repo.updateStatus(id, 'Data Verification')
    expect(o.status).toBe('Data Verification')
    expect(o.statusHistory).toHaveLength(1)
    expect(o.statusHistory![0].status).toBe('Data Verification')
    expect(new Date(o.statusHistory![0].at).getTime()).toBeGreaterThanOrEqual(before)
    expect(o.updatedAt).toBe(o.statusHistory![0].at)
    expect((await repo.getDetail(id)).status).toBe('Data Verification')
  })

  it('appends to the history on every change, oldest first', async () => {
    const id = idOf('JOB-2026-0007')
    await repo.updateStatus(id, 'Data Verification')
    await repo.updateStatus(id, 'Designing')
    await repo.updateStatus(id, 'Data Verification') // moving back is allowed and recorded
    const o = await repo.getDetail(id)
    expect(o.statusHistory!.map((h) => h.status)).toEqual(['Data Verification', 'Designing', 'Data Verification'])
    const times = o.statusHistory!.map((h) => h.at)
    expect(times).toEqual([...times].sort())
  })

  it('never advances anything by itself: only the requested order changes, and only to the requested status', async () => {
    const before = JSON.stringify(db.orders)
    await repo.updateStatus(idOf('JOB-2026-0007'), 'Printing') // skips stages on purpose; no intermediate stages are filled in
    const after = db.orders
    const changed = after.filter((o, i) => JSON.stringify(o) !== JSON.stringify((JSON.parse(before) as Order[])[i]))
    expect(changed.map((o) => o.orderNo)).toEqual(['JOB-2026-0007'])
    expect(changed[0].statusHistory!.map((h) => h.status)).toEqual(['Printing'])
  })

  it('rejects statuses outside the supported list, leaving the order untouched', async () => {
    const id = idOf('JOB-2026-0007')
    for (const bad of ['Cancelled', 'printing', 'Dispatched / Delivered', '', ' Designing', null, undefined, 7]) {
      expect(isRepositoryError(await rejection(repo.updateStatus(id, bad as never)), 'invalid_status'), String(bad)).toBe(true)
    }
    expect(JSON.stringify(db.orders)).toBe(JSON.stringify(seed))
  })

  it('rejects an unchanged status with no_change and records nothing', async () => {
    const id = idOf('JOB-2026-0003')
    expect(isRepositoryError(await rejection(repo.updateStatus(id, 'Printing')), 'no_change')).toBe(true)
    expect(db.orders.find((o) => o.id === id)!.statusHistory).toBeUndefined()
  })

  it('rejects a missing order, and an invalid id, without changing anything', async () => {
    expect(isRepositoryError(await rejection(repo.updateStatus('nope', 'Designing')), 'not_found')).toBe(true)
    expect(isRepositoryError(await rejection(repo.updateStatus('', 'Designing')), 'invalid_id')).toBe(true)
    expect(JSON.stringify(db.orders)).toBe(JSON.stringify(seed))
  })

  it('validates the id before the status, so a bad id is never reported as a status problem', async () => {
    expect(isRepositoryError(await rejection(repo.updateStatus('', 'Cancelled' as never)), 'invalid_id')).toBe(true)
  })
})

describe('admin ↔ public tracking synchronisation', () => {
  it('shows an admin status change on the public lookup of the same reference, immediately', async () => {
    expect((await repo.findByReference('JOB-2026-0007'))?.status).toBe('Order Received')
    await repo.updateStatus(idOf('JOB-2026-0007'), 'Designing')
    expect((await repo.findByReference('JOB-2026-0007'))?.status).toBe('Designing')
    expect((await repo.findByReference(' job 2026 0007 '))?.status).toBe('Designing') // existing normalisation still applies
  })

  it('stores one record: admin and public read the same order, not copies', async () => {
    const stored = db.orders.find((o) => o.orderNo === 'JOB-2026-0007')!
    await repo.updateStatus(stored.id, 'Quality Check')
    expect(stored.status).toBe('Quality Check') // the very same object in the shared database
    expect(Object.keys(db).filter((k) => /order/i.test(k))).toEqual(['orders']) // no second orders collection
  })

  it('drives the public timeline correctly for EVERY supported status', async () => {
    const id = idOf('JOB-2026-0007')
    let previous: OrderStatus = 'Order Received'
    for (const status of ORDER_STATUSES.slice(1)) {
      await repo.updateStatus(id, status)
      const pub = await repo.findByReference('JOB-2026-0007')
      expect(pub!.status).toBe(status)
      const stages = buildTimeline(pub!.status)
      const at = ORDER_STATUSES.indexOf(status)
      expect(stages).toHaveLength(7)
      expect(stages.filter((s) => s.state === 'current')).toHaveLength(status === 'Delivered' ? 0 : 1)
      expect(stages.filter((s) => s.state === 'completed')).toHaveLength(status === 'Delivered' ? 7 : at)
      expect(stages[6].label).toBe(status === 'Delivered' ? 'Delivered' : status === 'Dispatched' ? 'Dispatched' : 'Dispatched / Delivered')
      previous = status
    }
    expect(previous).toBe('Delivered')
  })

  it('keeps the public whitelist after a status change: no id, school id, notes or history', async () => {
    await repo.updateStatus(idOf('JOB-2026-0009'), 'Delivered')
    const pub = await repo.findByReference('JOB-2026-0009')
    expect(Object.keys(pub!).sort()).toEqual(['customer', 'expectedDelivery', 'orderDate', 'orderNo', 'quantity', 'service', 'status'])
    expect(JSON.stringify(pub)).not.toMatch(/AWB|notes|statusHistory|updatedAt|sch-|ord-/)
  })

  it('keeps exact-match tracking: partial and malformed references still find nothing after updates', async () => {
    await repo.updateStatus(idOf('JOB-2026-0007'), 'Designing')
    for (const v of ['JOB-2026-000', '2026-0007', 'JOB', 'JOB-2026-00077', '', '   ', '%', '*', 'JOB-2026-0007 OR 1=1']) {
      expect(await repo.findByReference(v), JSON.stringify(v)).toBeNull()
    }
  })

  it('still rejects (not hides) a lookup failure, and an admin update does not clear the failure hook', async () => {
    await repo.updateStatus(idOf('JOB-2026-0007'), 'Designing')
    await expect(repo.findByReference('job-fail')).rejects.toThrow()
  })

  it('is reflected by the dashboard and the school’s student page, which read the same orders', async () => {
    const before = (await dashboard.get()).counts
    expect(before.pendingOrders).toBe(2) // 0006 Data Verification + 0007 Order Received
    await repo.updateStatus(idOf('JOB-2026-0007'), 'Printing')
    const after = await dashboard.get()
    expect(after.counts.pendingOrders).toBe(1)
    expect(after.recentOrders.find((o) => o.orderNo === 'JOB-2026-0007')!.status).toBe('Printing')
    const student = db.students.find((s) => s.schoolId === 'sch-lotus')
    if (student) {
      const detail = await students.getDetail(student.id)
      expect(detail.schoolOrders.find((o) => o.orderNo === 'JOB-2026-0007')!.status).toBe('Printing')
    }
    const awaiting = after.counts.awaitingCompletion
    await repo.updateStatus(idOf('JOB-2026-0007'), 'Delivered')
    expect((await dashboard.get()).counts.awaitingCompletion).toBe(awaiting - 1)
  })
})

describe('order data integrity', () => {
  it('keeps the seeded demo orders (nine orders, every status present, no seeded history)', () => {
    expect(db.orders).toHaveLength(9)
    expect(new Set(db.orders.map((o) => o.status)).size).toBe(ORDER_STATUSES.length)
    expect(db.orders.every((o) => o.statusHistory === undefined)).toBe(true)
  })
})
