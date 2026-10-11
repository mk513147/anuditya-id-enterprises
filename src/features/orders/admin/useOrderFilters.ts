import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { OrderListParams } from '@/services/types'
import { ORDER_STATUSES, type OrderStatus } from '@/types'

export interface OrderFilters {
  q: string
  status: 'all' | OrderStatus
  from: string
  to: string
  page: number
}

const isStatus = (v: string | null): v is OrderStatus => !!v && (ORDER_STATUSES as readonly string[]).includes(v)

/** Same approach as the student list: filters and page live in the URL, so views are bookmarkable and Back works. */
export function useOrderFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<OrderFilters>(() => {
    const status = params.get('status')
    return {
      q: params.get('q') ?? '',
      status: isStatus(status) ? status : 'all',
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }
  }, [params])

  /** Applies a patch. Changing any filter (anything but `page`) returns to page 1. */
  const update = (patch: Partial<OrderFilters>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          const empty = v === '' || v === undefined || (k === 'status' && v === 'all') || (k === 'page' && v === 1)
          if (empty) next.delete(k)
          else next.set(k, String(v))
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const clear = () => setParams({}, { replace: true, preventScrollReset: true })
  const hasActiveFilters = !!filters.q || filters.status !== 'all' || !!filters.from || !!filters.to

  return { filters, update, clear, hasActiveFilters }
}

export const toOrderListParams = (f: OrderFilters, pageSize = 10): OrderListParams => ({
  search: f.q || undefined,
  status: f.status,
  from: f.from || undefined,
  to: f.to || undefined,
  page: f.page,
  pageSize,
})
