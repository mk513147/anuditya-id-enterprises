import type { OrderListResult } from '@/services/types'

/** Overall (unfiltered) figures for the stat cards. Groups follow the dashboard's own definitions. */
export function orderStatGroups({ total, byStatus }: OrderListResult['counts']) {
  return {
    total,
    /** Not started: Order Received or Data Verification (same as the dashboard's "pending"). */
    awaitingStart: byStatus['Order Received'] + byStatus['Data Verification'],
    inProduction: byStatus.Designing + byStatus.Printing + byStatus['Quality Check'],
    readyOrDispatched: byStatus.Ready + byStatus.Dispatched,
    delivered: byStatus.Delivered,
  }
}
