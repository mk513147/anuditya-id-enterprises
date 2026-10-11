import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { serviceRepository } from '@/services'
import type { ServiceListParams } from '@/services/types'
import type { ID, ServiceInput } from '@/types'

export const serviceKeys = {
  all: ['services'] as const,
  list: (params: ServiceListParams) => ['services', 'list', params] as const,
}

export const useAdminServices = (params: ServiceListParams) =>
  useQuery({ queryKey: serviceKeys.list(params), queryFn: () => serviceRepository.list(params), placeholderData: keepPreviousData, staleTime: 0, retry: false })

/**
 * Every write refreshes everything under ['services'], which includes the public query that the Home page,
 * /services and the quote dialog read, so a change shows there without a reload.
 */
function useInvalidateAfterWrite() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: serviceKeys.all })
}

export function useCreateService() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (input: ServiceInput) => serviceRepository.create(input), onSuccess: invalidate })
}

export function useUpdateService() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; patch: Partial<ServiceInput> }) => serviceRepository.update(v.id, v.patch), onSuccess: invalidate })
}

export function useSetServiceEnabled() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; enabled: boolean }) => serviceRepository.setEnabled(v.id, v.enabled), onSuccess: invalidate })
}
