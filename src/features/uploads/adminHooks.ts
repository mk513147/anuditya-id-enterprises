import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fileRepository } from '@/services'
import type { FileListParams } from '@/services/types'
import type { FileReviewStatus, ID } from '@/types'

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

/** A fresh signed link per click. A mutation, so the link is never kept in the query cache. */
export const useFileDownload = () => useMutation({ mutationFn: (id: ID) => fileRepository.getDownloadUrl(id), gcTime: 0 })

/** Approve / reject / request corrections / back to pending, with notes. Refreshes the file list, the detail and the dashboard. */
export function useReviewFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: ID; status: FileReviewStatus; notes: string }) => fileRepository.review(v.id, v.status, v.notes),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: fileKeys.all }), qc.invalidateQueries({ queryKey: ['dashboard'] })]),
  })
}
