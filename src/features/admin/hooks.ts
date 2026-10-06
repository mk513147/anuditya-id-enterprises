import { useQuery } from '@tanstack/react-query'
import { dashboardRepository } from '@/services'

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => dashboardRepository.get(), staleTime: 0, refetchOnMount: 'always' })
