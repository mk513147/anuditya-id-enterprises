import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isServiceCategory } from '@/data/serviceCategories'
import type { ServiceListParams } from '@/services/types'
import type { ServiceCategory } from '@/types'

export interface ServiceFilters {
  q: string
  category: 'all' | ServiceCategory
  status: NonNullable<ServiceListParams['status']>
  page: number
}

/** Filters and page live in the URL, like the other admin lists. Unknown values fall back to "all". */
export function useServiceFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<ServiceFilters>(() => {
    const category = params.get('category')
    const status = params.get('status')
    return {
      q: params.get('q') ?? '',
      category: isServiceCategory(category) ? category : 'all',
      status: status === 'enabled' || status === 'disabled' ? status : 'all',
      page: Math.max(1, Number(params.get('page')) || 1),
    }
  }, [params])

  const update = (patch: Partial<ServiceFilters>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          const empty = v === '' || v === undefined || v === 'all' || (k === 'page' && v === 1)
          if (empty) next.delete(k)
          else next.set(k, String(v))
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const clear = () => setParams({}, { replace: true, preventScrollReset: true })
  const hasActiveFilters = !!filters.q || filters.category !== 'all' || filters.status !== 'all'

  return { filters, update, clear, hasActiveFilters }
}

export const toServiceListParams = (f: ServiceFilters, pageSize = 10): ServiceListParams => ({
  search: f.q || undefined,
  category: f.category,
  status: f.status,
  page: f.page,
  pageSize,
})
