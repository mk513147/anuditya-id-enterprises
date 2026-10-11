import { useQuery } from '@tanstack/react-query'
import { dashboardRepository } from '@/services'

/** Each dashboard widget has its own query, so one failing widget does not hide the others. */
const fresh = { staleTime: 0, refetchOnMount: 'always' as const, retry: 1 }

export const useDashboardCounts = () => useQuery({ queryKey: ['dashboard', 'counts'], queryFn: () => dashboardRepository.getCounts(), ...fresh })
export const useRecentOrders = () => useQuery({ queryKey: ['dashboard', 'recent-orders'], queryFn: () => dashboardRepository.getRecentOrders(), ...fresh })
export const useRecentSchools = () => useQuery({ queryKey: ['dashboard', 'recent-schools'], queryFn: () => dashboardRepository.getRecentSchools(), ...fresh })
