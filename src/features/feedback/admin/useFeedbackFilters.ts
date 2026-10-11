import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FeedbackListParams } from '@/services/types'
import type { FeedbackStatus } from '@/types'

export interface FeedbackFilters {
  q: string
  status: 'all' | FeedbackStatus
  /** '' = any rating, otherwise '1'..'5'. */
  rating: string
  page: number
}

const STATUSES = ['pending', 'approved', 'rejected']

/** Filters and page live in the URL, like the other admin lists. Unknown values fall back to "all". */
export function useFeedbackFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<FeedbackFilters>(() => {
    const status = params.get('status')
    const rating = params.get('rating')
    return {
      q: params.get('q') ?? '',
      status: status && STATUSES.includes(status) ? (status as FeedbackStatus) : 'all',
      rating: rating && ['1', '2', '3', '4', '5'].includes(rating) ? rating : '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }
  }, [params])

  const update = (patch: Partial<FeedbackFilters>) =>
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
  const hasActiveFilters = !!filters.q || filters.status !== 'all' || !!filters.rating

  return { filters, update, clear, hasActiveFilters }
}

export const toFeedbackListParams = (f: FeedbackFilters, pageSize = 10): FeedbackListParams => ({
  search: f.q || undefined,
  status: f.status,
  rating: f.rating ? (Number(f.rating) as 1 | 2 | 3 | 4 | 5) : 'all',
  page: f.page,
  pageSize,
})
