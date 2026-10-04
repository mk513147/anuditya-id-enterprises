import { useQuery } from '@tanstack/react-query'
import { feedbackRepository } from '@/services'

export const useApprovedFeedback = () =>
  useQuery({ queryKey: ['feedback', 'approved'], queryFn: () => feedbackRepository.listApproved() })
