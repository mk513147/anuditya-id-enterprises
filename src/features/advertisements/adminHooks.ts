import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { advertisementRepository } from '@/services'
import type { AdvertisementListParams } from '@/services/types'
import type { AdvertisementInput, ID } from '@/types'

export const adKeys = {
  all: ['advertisements'] as const,
  list: (params: AdvertisementListParams) => ['advertisements', 'list', params] as const,
}

export const useAdminAdvertisements = (params: AdvertisementListParams) =>
  useQuery({ queryKey: adKeys.list(params), queryFn: () => advertisementRepository.list(params), placeholderData: keepPreviousData, staleTime: 0, retry: false })

/**
 * Every write refreshes everything under ['advertisements'], which includes the public query that the Home
 * page and /advertisement read, so a change shows there without a reload.
 */
function useInvalidateAfterWrite() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: adKeys.all })
}

export function useCreateAdvertisement() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (input: AdvertisementInput) => advertisementRepository.create(input), onSuccess: invalidate })
}

export function useUpdateAdvertisement() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; patch: Partial<AdvertisementInput> }) => advertisementRepository.update(v.id, v.patch), onSuccess: invalidate })
}

export function useSetAdvertisementActive() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; active: boolean }) => advertisementRepository.setActive(v.id, v.active), onSuccess: invalidate })
}

export function useSetAdvertisementPublished() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; published: boolean }) => advertisementRepository.setPublished(v.id, v.published), onSuccess: invalidate })
}
