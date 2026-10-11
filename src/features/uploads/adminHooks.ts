import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fileRepository } from '@/services'
import type { FileListParams } from '@/services/types'
import type { ID } from '@/types'

export const fileKeys = {
  all: ['files'] as const,
  list: (params: FileListParams) => ['files', 'list', params] as const,
  detail: (id: ID) => ['files', 'detail', id] as const,
}

/** Admin list. Keeps showing the previous rows while a new search/filter/page loads. Always refetched, so a fresh public upload shows up. */
export const useAdminFiles = (params: FileListParams) =>
  useQuery({ queryKey: fileKeys.list(params), queryFn: () => fileRepository.list(params), placeholderData: keepPreviousData, staleTime: 0, retry: false })

export const useAdminFile = (id: ID | null) =>
  useQuery({ queryKey: fileKeys.detail(id ?? ''), queryFn: () => fileRepository.getDetail(id as ID), enabled: id !== null, staleTime: 0, retry: false })
