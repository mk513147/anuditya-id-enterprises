import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { StudentListParams } from '@/services/types'

export interface StudentFilters {
  q: string
  school: string
  cls: string
  section: string
  status: NonNullable<StudentListParams['status']>
  from: string
  to: string
  page: number
}

export const DEFAULT_STATUS: StudentFilters['status'] = 'active'
const KEYS = ['q', 'school', 'cls', 'section', 'status', 'from', 'to', 'page'] as const

/**
 * Filter + pagination state lives in the URL query string, so a filtered view can be bookmarked and
 * "Back" from a student's detail page returns to the same filters and page.
 */
export function useStudentFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<StudentFilters>(() => {
    const status = params.get('status')
    return {
      q: params.get('q') ?? '',
      school: params.get('school') ?? '',
      cls: params.get('cls') ?? '',
      section: params.get('section') ?? '',
      status: status === 'archived' || status === 'all' ? status : DEFAULT_STATUS,
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }
  }, [params])

  /** Applies a patch. Changing any filter (anything but `page`) returns to page 1. */
  const update = (patch: Partial<StudentFilters>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          const empty = v === '' || v === undefined || (k === 'status' && v === DEFAULT_STATUS) || (k === 'page' && v === 1)
          if (empty) next.delete(k)
          else next.set(k, String(v))
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const clear = () => setParams({}, { replace: true, preventScrollReset: true })

  /** True when anything differs from the default view (active students, no filters). */
  const hasActiveFilters = KEYS.some((k) => k !== 'page' && params.has(k) && !(k === 'status' && filters.status === DEFAULT_STATUS))

  return { filters, update, clear, hasActiveFilters }
}

export const toListParams = (f: StudentFilters, pageSize = 10): StudentListParams => ({
  search: f.q || undefined,
  schoolId: f.school || undefined,
  className: f.cls || undefined,
  section: f.section || undefined,
  status: f.status,
  submittedFrom: f.from || undefined,
  submittedTo: f.to || undefined,
  page: f.page,
  pageSize,
})
