import { ORDER_STATUSES, type OrderStatus } from '@/types'

/** The seven public stages. Dispatched and Delivered share the last stage. */
export const TIMELINE_STAGES = [
  'Order Received',
  'Data Verification',
  'Designing',
  'Printing',
  'Quality Check',
  'Ready',
  'Dispatched / Delivered',
] as const

export type StageState = 'completed' | 'current' | 'upcoming'

export interface TimelineStage {
  label: string
  state: StageState
}

/**
 * Maps an order status onto the seven stages.
 * - Before the final stage: earlier stages are completed, the matching one is current, later ones upcoming.
 * - Dispatched: stages 1-6 completed, the final stage is current and reads "Dispatched".
 * - Delivered: all seven completed (nothing is "current" any more) and the final stage reads "Delivered".
 * (Orders have no cancelled status in the data model, so there is no cancelled state to draw.)
 */
export function buildTimeline(status: OrderStatus): TimelineStage[] {
  const at = ORDER_STATUSES.indexOf(status) // Received 0 … Dispatched 6, Delivered 7
  const delivered = status === 'Delivered'
  return TIMELINE_STAGES.map((label, i): TimelineStage => {
    const state: StageState = delivered || i < at ? 'completed' : i === at ? 'current' : 'upcoming'
    const finalLabel = delivered ? 'Delivered' : status === 'Dispatched' ? 'Dispatched' : label
    return { label: i === TIMELINE_STAGES.length - 1 ? finalLabel : label, state }
  })
}

/** One plain-language sentence describing where the order is. */
export const STATUS_MESSAGE: Record<OrderStatus, string> = {
  'Order Received': 'We have received your order and will start checking it shortly.',
  'Data Verification': 'We are checking the student data and details you sent.',
  Designing: 'Your design is being prepared.',
  Printing: 'Your order is being printed.',
  'Quality Check': 'Your printed items are being checked for quality.',
  Ready: 'Your order is ready. We will arrange dispatch.',
  Dispatched: 'Your order has been dispatched and is on its way.',
  Delivered: 'This order has been delivered.',
}
