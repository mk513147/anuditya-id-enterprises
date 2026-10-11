import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { feedbackRepository } from '@/services'
import type { FeedbackListParams } from '@/services/types'
import type { FeedbackStatus, ID } from '@/types'

export const feedbackKeys = {
  all: ['feedback'] as const,
  list: (params: FeedbackListParams) => ['feedback', 'list', params] as const,
  detail: (id: ID) => ['feedback', 'detail', id] as const,
}

export const useAdminFeedback = (params: FeedbackListParams) =>
  useQuery({ queryKey: feedbackKeys.list(params), queryFn: () => feedbackRepository.list(params), placeholderData: keepPreviousData, staleTime: 0, retry: false })

export const useAdminFeedbackItem = (id: ID | null) =>
  useQuery({ queryKey: feedbackKeys.detail(id ?? ''), queryFn: () => feedbackRepository.getDetail(id as ID), enabled: id !== null, staleTime: 0, retry: false })

/** Refreshes everything under ['feedback'], including the approved list the Home page and /feedback read. */
export function useSetFeedbackStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: ID; status: FeedbackStatus }) => feedbackRepository.setStatus(v.id, v.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all }),
  })
}
