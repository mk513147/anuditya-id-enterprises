import { delay } from '@/lib/delay'
import { ORDER_REFERENCE_PATTERN, normalizeOrderReference } from '@/lib/orderReference'
import { formatTrackingCode, isWellFormedTrackingCode, normalizeTrackingCode } from '@/lib/trackingCode'
import { ORDER_STATUSES, type ID, type Order, type OrderStatus, type PublicOrder } from '@/types'
import { orderInputSchema } from '@/validations/order'
import { RepositoryError } from '../errors'
import type { AdminOrder, OrderRepository } from '../types'
import { parseInput } from '../validate'
import { db } from './db'

/**
 * Prototype hook for testing the error state: look up the reference "JOB-FAIL".
 * A real repository would reject the same way on a network/database error.
 */
export const MOCK_ORDER_LOOKUP_FAILURE_REF = 'JOB-FAIL'

/**
 * DEMO ONLY: the tracking code of every seeded demo order, published on the Job Status page in demo mode so the
 * prototype can be explored. Real codes are random per order and exist only in the live database (as a hash).
 */
export const MOCK_DEMO_TRACKING_CODE = 'DEMQA-TRACK-C2DEX-AMPLE-ABCDE'

/** In-memory codes (canonical form), keyed by order id. Module state like `db`: reset on refresh, never in browser storage. */
const codes = new Map<ID, string>(db.orders.map((o) => [o.id, normalizeTrackingCode(MOCK_DEMO_TRACKING_CODE)]))

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newTrackingCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(25))
  return formatTrackingCode(Array.from(bytes, (b) => ALPHABET[b & 31]).join(''))
}

/** Whitelist projection: internal notes, ids and the school id are deliberately left out. */
const toPublicOrder = (o: Order): PublicOrder => ({
  orderNo: o.orderNo,
  customer: o.customer,
  service: o.service,
  quantity: o.quantity,
  status: o.status,
  orderDate: o.orderDate,
  expectedDelivery: o.expectedDelivery,
})

/** Joins the owning school by ID (falling back to the stored display name) and returns a detached copy. */
function toAdminOrder(o: Order): AdminOrder {
  const school = o.schoolId ? db.schools.find((s) => s.id === o.schoolId) : undefined
  return { ...o, statusHistory: o.statusHistory?.map((h) => ({ ...h })), schoolName: school?.name ?? o.customer, schoolCode: school?.code }
}

const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)

function findById(id: ID): Order {
  if (typeof id !== 'string' || id.trim() === '') throw new RepositoryError('invalid_id', 'An order id is required.')
  const order = db.orders.find((o) => o.id === id)
  if (!order) throw new RepositoryError('not_found', 'Order not found.')
  return order
}

export const mockOrderRepository: OrderRepository = {
  async track(orderNo, trackingCode) {
    await delay(700)
    const ref = normalizeOrderReference(orderNo)
    if (ref === MOCK_ORDER_LOOKUP_FAILURE_REF) throw new Error('Mock order lookup failure')
    // Never match on malformed or empty input; a wrong code and an unknown number look the same.
    if (!ORDER_REFERENCE_PATTERN.test(ref) || !isWellFormedTrackingCode(trackingCode)) return null
    const order = db.orders.find((o) => o.orderNo.toUpperCase() === ref) // exact match only
    if (!order || codes.get(order.id) !== normalizeTrackingCode(trackingCode)) return null
    return toPublicOrder(order)
  },

  async create(input) {
    await delay(500)
    const v = parseInput(orderInputSchema, { schoolId: '', customer: '', notes: '', ...input }, 'Invalid order.')
    const school = v.schoolId ? db.schools.find((s) => s.id === v.schoolId) : undefined
    if (v.schoolId && !school) throw new RepositoryError('not_found', 'School not found.')
    const year = new Date().getFullYear()
    const next = Math.max(0, ...db.orders.map((o) => Number(/-(\d+)$/.exec(o.orderNo)?.[1] ?? 0))) + 1
    const now = new Date().toISOString()
    const order: Order = {
      id: crypto.randomUUID(),
      orderNo: `JOB-${year}-${String(next).padStart(4, '0')}`,
      schoolId: school?.id,
      customer: school?.name ?? v.customer,
      service: v.service,
      quantity: v.quantity,
      status: 'Order Received',
      orderDate: v.orderDate,
      expectedDelivery: v.expectedDelivery,
      notes: v.notes || undefined,
      updatedAt: now,
    }
    db.orders.push(order)
    const trackingCode = newTrackingCode()
    codes.set(order.id, normalizeTrackingCode(trackingCode))
    return { order: toAdminOrder(order), trackingCode }
  },

  async rotateTrackingCode(id) {
    await delay(400)
    const order = findById(id)
    const trackingCode = newTrackingCode()
    codes.set(order.id, normalizeTrackingCode(trackingCode)) // the previous code stops working
    return trackingCode
  },

  async list({ search = '', status = 'all', from, to, page = 1, pageSize = 10 } = {}) {
    await delay(250)
    const q = search.trim().toLowerCase()
    const ref = normalizeOrderReference(search).toLowerCase()
    const matches = db.orders
      .map(toAdminOrder)
      .filter((o) => status === 'all' || o.status === status)
      // orderDate is already a calendar date (YYYY-MM-DD), so plain string comparison is correct.
      .filter((o) => (!from || o.orderDate >= from) && (!to || o.orderDate <= to))
      .filter((o) => !q || o.orderNo.toLowerCase().includes(q) || (ref && o.orderNo.toLowerCase().includes(ref)) || o.schoolName.toLowerCase().includes(q))
      .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.orderNo.localeCompare(a.orderNo))

    const total = matches.length
    const size = Math.max(1, pageSize)
    const totalPages = Math.max(1, Math.ceil(total / size))
    const current = Math.min(Math.max(1, page), totalPages)
    const byStatus = Object.fromEntries(ORDER_STATUSES.map((st) => [st, db.orders.filter((o) => o.status === st).length])) as Record<OrderStatus, number>
    return {
      items: matches.slice((current - 1) * size, current * size),
      total,
      page: current,
      pageSize: size,
      totalPages,
      counts: { total: db.orders.length, byStatus },
    }
  },

  async getDetail(id) {
    await delay(250)
    return toAdminOrder(findById(id))
  },

  async updateStatus(id, status) {
    await delay(500)
    // Validated here as well as in the UI: this is the layer a real backend must enforce independently.
    const order = findById(id)
    if (!isOrderStatus(status)) throw new RepositoryError('invalid_status', 'That is not a supported order status.')
    if (order.status === status) throw new RepositoryError('no_change', `The order is already "${status}".`)
    const at = new Date().toISOString()
    // Mutates the one shared record, so the public lookup and the dashboard see it straight away.
    order.status = status
    order.updatedAt = at
    order.statusHistory = [...(order.statusHistory ?? []), { status, at }]
    return toAdminOrder(order)
  },
}
