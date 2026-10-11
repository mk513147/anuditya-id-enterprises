import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FileListParams } from '@/services/types'
import { FILE_REVIEW_STATUSES, type FileReviewStatus, type UploadedFileType } from '@/types'
import { isAcceptedExtension } from '@/validations/upload'

export interface FileFilters {
  q: string
  /** '' = all schools, 'none' = files with no school, otherwise a school id. */
  school: string
  type: 'all' | UploadedFileType
  review: 'all' | FileReviewStatus
  from: string
  to: string
  page: number
}

/** Same approach as the student and order lists: filters and page live in the URL. */
export function useFileFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<FileFilters>(() => {
    const type = params.get('type')
    const review = FILE_REVIEW_STATUSES.find((s) => s === params.get('review')) ?? 'all'
    return {
      q: params.get('q') ?? '',
      school: params.get('school') ?? '',
      type: type && isAcceptedExtension(type) ? type : 'all',
      review,
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      page: Math.max(1, Number(params.get('page')) || 1),
    }
  }, [params])

  const update = (patch: Partial<FileFilters>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          const empty = v === '' || v === undefined || ((k === 'type' || k === 'review') && v === 'all') || (k === 'page' && v === 1)
          if (empty) next.delete(k)
          else next.set(k, String(v))
        }
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const clear = () => setParams({}, { replace: true, preventScrollReset: true })
  const hasActiveFilters = !!filters.q || !!filters.school || filters.type !== 'all' || filters.review !== 'all' || !!filters.from || !!filters.to

  return { filters, update, clear, hasActiveFilters }
}

export const toFileListParams = (f: FileFilters, pageSize = 10): FileListParams => ({
  search: f.q || undefined,
  schoolId: f.school || undefined,
  type: f.type,
  reviewStatus: f.review,
  from: f.from || undefined,
  to: f.to || undefined,
  page: f.page,
  pageSize,
})
