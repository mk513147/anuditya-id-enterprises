import { useQuery } from '@tanstack/react-query'
import { orderRepository } from '@/services'

/**
 * Looks up one order by reference. Pass null while nothing has been submitted (the query stays idle).
 * Results are never cached across lookups, so a status change is picked up on the next check.
 */
export const useTrackOrder = (reference: string | null) =>
  useQuery({
    queryKey: ['orders', 'track', reference],
    queryFn: () => orderRepository.findByReference(reference as string),
    enabled: !!reference,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
