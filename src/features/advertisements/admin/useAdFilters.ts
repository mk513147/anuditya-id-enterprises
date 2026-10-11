import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AdVisibility } from '@/lib/advertisements'
import type { AdvertisementListParams } from '@/services/types'

export interface AdFilters {
  q: string
  published: NonNullable<AdvertisementListParams['published']>
  active: NonNullable<AdvertisementListParams['active']>
  visibility: 'all' | AdVisibility
  runsOn: string
  page: number
}

const VISIBILITIES = ['live', 'scheduled', 'ended', 'hidden']

/** Filters and page live in the URL, like the other admin lists. Unknown values fall back to "all". */
export function useAdFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<AdFilters>(() => {
    const published = params.get('published')
    const active = params.get('active')
    const visibility = params.get('visibility')
    return {
      q: params.get('q') ?? '',
      published: published === 'published' || published === 'draft' ? published : 'all',
      active: active === 'enabled' || active === 'disabled' ? active : 'all',
      visibility: visibility && VISIBILITIES.includes(visibility) ? (visibility as AdVisibility) : 'all',
      runsOn: params.get('runsOn') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }
  }, [params])

  const update = (patch: Partial<AdFilters>) =>
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
  const hasActiveFilters = !!filters.q || filters.published !== 'all' || filters.active !== 'all' || filters.visibility !== 'all' || !!filters.runsOn

  return { filters, update, clear, hasActiveFilters }
}

export const toAdListParams = (f: AdFilters, pageSize = 10): AdvertisementListParams => ({
  search: f.q || undefined,
  published: f.published,
  active: f.active,
  visibility: f.visibility,
  runsOn: f.runsOn || undefined,
  page: f.page,
  pageSize,
})
