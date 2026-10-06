import type { OrderStatus } from '@/types'
import { cn } from '@/lib/utils'

export type BadgeTone = 'neutral' | 'blue' | 'gold' | 'green'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-royal-50 text-royal-700 ring-royal-100',
  gold: 'bg-gold-100 text-gold-700 ring-gold-400/40',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
}

/** Text is always present, so status is never conveyed by colour alone. */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', TONES[tone])}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

const ORDER_TONE: Record<OrderStatus, BadgeTone> = {
  'Order Received': 'neutral',
  'Data Verification': 'blue',
  Designing: 'blue',
  Printing: 'gold',
  'Quality Check': 'gold',
  Ready: 'green',
  Dispatched: 'blue',
  Delivered: 'green',
}

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => <StatusBadge tone={ORDER_TONE[status]}>{status}</StatusBadge>

export const ActiveBadge = ({ active }: { active: boolean }) => (
  <StatusBadge tone={active ? 'green' : 'neutral'}>{active ? 'Active' : 'Inactive'}</StatusBadge>
)
