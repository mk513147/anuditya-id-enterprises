import { delay } from '@/lib/delay'
import { ORDER_REFERENCE_PATTERN, normalizeOrderReference } from '@/lib/orderReference'
import type { Order, PublicOrder } from '@/types'
import type { OrderRepository } from '../types'
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

export const mockOrderRepository: OrderRepository = {
  async findByReference(reference) {
    await delay(700)
    const ref = normalizeOrderReference(reference)
    if (ref === MOCK_ORDER_LOOKUP_FAILURE_REF) throw new Error('Mock order lookup failure')
    if (!ORDER_REFERENCE_PATTERN.test(ref)) return null // never match on malformed or empty input
    const order = db.orders.find((o) => o.orderNo.toUpperCase() === ref) // exact match only
    return order ? toPublicOrder(order) : null
  },
}
