import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { feedbackRepository } from '@/services'
import type { FeedbackInput } from '@/types'

export const useApprovedFeedback = () =>
  useQuery({ queryKey: ['feedback', 'approved'], queryFn: () => feedbackRepository.listApproved() })

/** Submits public feedback. It is stored as pending approval, so the public list does not change. */
export function useSubmitFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FeedbackInput) => feedbackRepository.submit(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  })
}
