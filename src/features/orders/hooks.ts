import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { orderRepository } from '@/services'
import type { OrderListParams } from '@/services/types'
import type { ID, OrderInput, OrderStatus } from '@/types'

export const orderKeys = {
  all: ['orders'] as const,
  list: (params: OrderListParams) => ['orders', 'list', params] as const,
  detail: (id: ID) => ['orders', 'detail', id] as const,
}

/**
 * Public lookup by order number AND tracking code. A mutation, not a cached query: the code must not end up in a query
 * key / cache, and every check fetches the current status.
 */
export const useTrackOrder = () =>
  useMutation({ mutationFn: (v: { orderNo: string; trackingCode: string }) => orderRepository.track(v.orderNo, v.trackingCode), retry: false, gcTime: 0 })

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

/** Creates an order. The result carries the one-time tracking code: show it, never cache or log it. */
export function useCreateOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: OrderInput) => orderRepository.create(input),
    gcTime: 0, // the result holds the one-time tracking code: do not keep it in the mutation cache
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: orderKeys.all }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
        qc.invalidateQueries({ queryKey: ['schools'] }),
      ]),
  })
}

/** Issues a new tracking code for an order; the previous one stops working. */
export const useRotateTrackingCode = () => useMutation({ mutationFn: (id: ID) => orderRepository.rotateTrackingCode(id), gcTime: 0 })
