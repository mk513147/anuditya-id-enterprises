import { normalizeOrderReference, ORDER_REFERENCE_PATTERN } from '@/lib/orderReference'
import { formatTrackingCode, isWellFormedTrackingCode } from '@/lib/trackingCode'
import { ORDER_STATUSES, type OrderStatus, type PublicOrder } from '@/types'
import { orderInputSchema } from '@/validations/order'
import { RepositoryError } from '../errors'
import type { OrderRepository } from '../types'
import { parseInput } from '../validate'
import { ORDER_WITH_SCHOOL, toAdminOrder, type OrderRow } from './rows'
import { fetchSummary } from './summary'
import { fetchPage, guarded, ilikeAny, requireClient, requireId, searchTerm, unwrap, type Client } from './shared'

const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === 'string' && (ORDER_STATUSES as readonly string[]).includes(v)
const DAY = /^\d{4}-\d{2}-\d{2}$/

export function createSupabaseOrderRepository(client: Client | null): OrderRepository {
  async function readOne(c: Client, id: string) {
    const [orderRes, historyRes] = await Promise.all([
      guarded(() => Promise.resolve(c.from('orders').select(ORDER_WITH_SCHOOL).eq('id', id).maybeSingle())),
      guarded(() => Promise.resolve(c.from('order_status_history').select('status, changed_at').eq('order_id', id).order('changed_at').order('id'))),
    ])
    const row = unwrap(orderRes) as OrderRow | null
    if (!row) throw new RepositoryError('not_found', 'Order not found.')
    const history = unwrap(historyRes) as { status: OrderStatus; changed_at: string }[]
    return { ...toAdminOrder(row), statusHistory: history.map((h) => ({ status: h.status, at: h.changed_at })) }
  }

  return {
    async track(orderNo, trackingCode) {
      const c = requireClient(client)
      const ref = normalizeOrderReference(orderNo)
      // Malformed input never reaches the server. The function needs BOTH values and returns nothing for either mistake.
      if (!ORDER_REFERENCE_PATTERN.test(ref) || !isWellFormedTrackingCode(trackingCode)) return null
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('track_order', { p_order_no: ref, p_tracking_code: trackingCode })))) as
        { order_no: string; customer_name: string; service: string; quantity: number; status: OrderStatus; order_date: string; expected_delivery: string }[]
      const r = rows[0]
      if (!r) return null
      const order: PublicOrder = {
        orderNo: r.order_no,
        customer: r.customer_name,
        service: r.service,
        quantity: r.quantity,
        status: r.status,
        orderDate: r.order_date,
        expectedDelivery: r.expected_delivery,
      }
      return order
    },

    async create(input) {
      const c = requireClient(client)
      const v = parseInput(orderInputSchema, { schoolId: '', customer: '', notes: '', ...input }, 'Invalid order.')
      if (v.schoolId) requireId(v.schoolId, 'school')
      const rows = unwrap(
        await guarded(() =>
          Promise.resolve(
            c.rpc('admin_create_order', {
              p_school_id: v.schoolId || null,
              p_customer_name: v.customer || null,
              p_service: v.service,
              p_quantity: v.quantity,
              p_order_date: v.orderDate,
              p_expected_delivery: v.expectedDelivery,
              p_internal_notes: v.notes || null,
            }),
          ),
        ),
      ) as { order_id: string; order_no: string; tracking_code: string }[]
      const r = rows[0]
      if (!r) throw new RepositoryError('unknown', 'The order could not be confirmed. Please refresh the list before trying again.')
      return { order: await readOne(c, r.order_id), trackingCode: formatTrackingCode(r.tracking_code) }
    },

    async rotateTrackingCode(id) {
      const c = requireClient(client)
      const orderId = requireId(id, 'order')
      const code = unwrap(await guarded(() => Promise.resolve(c.rpc('admin_rotate_tracking_code', { p_order_id: orderId })))) as string | null
      if (!code) throw new RepositoryError('unknown', 'No new tracking code was issued. Please try again.')
      return formatTrackingCode(code)
    },

    async list(params = {}) {
      const c = requireClient(client)
      const { search, status = 'all', from, to, page, pageSize } = params
      if (status !== 'all' && !isOrderStatus(status)) throw new RepositoryError('invalid_filter', 'That status is not supported.')
      for (const d of [from, to]) if (d && !DAY.test(d)) throw new RepositoryError('invalid_filter', 'Dates must be real calendar dates.')
      const query = () => {
        let q = c.from('orders').select(ORDER_WITH_SCHOOL, { count: 'exact' })
        if (status !== 'all') q = q.eq('status', status)
        // order_date is a calendar date, so the inclusive range is a plain comparison.
        if (from) q = q.gte('order_date', from)
        if (to) q = q.lte('order_date', to)
        // customer_name is kept equal to the owning school's name by a database trigger, so it covers the school search.
        const term = searchTerm(search)
        const ref = searchTerm(normalizeOrderReference(search ?? ''))
        if (term) q = q.or(ilikeAny(['order_no', 'customer_name'], term) + (ref && ref !== term ? `,${ilikeAny(['order_no'], ref)}` : ''))
        return q.order('order_date', { ascending: false }).order('order_no', { ascending: false })
      }
      const [result, summary] = await Promise.all([fetchPage<OrderRow>((f, t) => query().range(f, t), page, pageSize), fetchSummary(c)])
      return { ...result, items: result.items.map(toAdminOrder), counts: { total: summary.orders.total, byStatus: summary.orders.byStatus } }
    },

    async getDetail(id) {
      const c = requireClient(client)
      return readOne(c, requireId(id, 'order'))
    },

    async updateStatus(id, status) {
      const c = requireClient(client)
      const orderId = requireId(id, 'order')
      if (!isOrderStatus(status)) throw new RepositoryError('invalid_status', 'That is not a supported order status.')
      const rows = unwrap(await guarded(() => Promise.resolve(c.rpc('admin_set_order_status', { p_order_id: orderId, p_status: status })))) as unknown[]
      if (!rows?.length) throw new RepositoryError('not_found', 'Order not found.')
      return readOne(c, orderId)
    },
  }
}
