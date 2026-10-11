import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderRepository } from '@/services'
import type { OrderListParams } from '@/services/types'
import type { ID, OrderStatus } from '@/types'

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: OrderListParams) => ['orders', 'list', params] as const,
  detail: (id: ID) => ['orders', 'detail', id] as const,
}

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

/** Admin list. Keeps showing the previous rows while a new search/filter/page loads. */
export const useAdminOrders = (params: OrderListParams) =>
  useQuery({ queryKey: orderKeys.list(params), queryFn: () => orderRepository.list(params), placeholderData: keepPreviousData, staleTime: 0 })

export const useAdminOrder = (id: ID) =>
  useQuery({ queryKey: orderKeys.detail(id), queryFn: () => orderRepository.getDetail(id), staleTime: 0, retry: false })

/**
 * Changes an order's status through the shared repository. Orders feed the dashboard and each
 * school's student page, so a successful write refreshes all of them.
 */
export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: ID; status: OrderStatus }) => orderRepository.updateStatus(v.id, v.status),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: orderKeys.all }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
        qc.invalidateQueries({ queryKey: ['students'] }),
      ]),
  })
}
