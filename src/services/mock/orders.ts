import { delay } from '@/lib/delay'
import { ORDER_REFERENCE_PATTERN, normalizeOrderReference } from '@/lib/orderReference'
import { ORDER_STATUSES, type ID, type Order, type OrderStatus, type PublicOrder } from '@/types'
import { RepositoryError } from '../errors'
import type { AdminOrder, OrderRepository } from '../types'
import { db } from './db'

/**
 * Prototype hook for testing the error state: look up the reference "JOB-FAIL".
 * A real repository would reject the same way on a network/database error.
 */
export const MOCK_ORDER_LOOKUP_FAILURE_REF = 'JOB-FAIL'

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
  async findByReference(reference) {
    await delay(700)
    const ref = normalizeOrderReference(reference)
    if (ref === MOCK_ORDER_LOOKUP_FAILURE_REF) throw new Error('Mock order lookup failure')
    if (!ORDER_REFERENCE_PATTERN.test(ref)) return null // never match on malformed or empty input
    const order = db.orders.find((o) => o.orderNo.toUpperCase() === ref) // exact match only
    return order ? toPublicOrder(order) : null
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
