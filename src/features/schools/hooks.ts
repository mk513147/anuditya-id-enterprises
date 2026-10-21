import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { schoolRepository } from '@/services'
import type { SchoolListParams } from '@/services/types'
import type { ID, SchoolImageStatus, SchoolImageSubmission, SchoolInput } from '@/types'

export const schoolKeys = {
  all: ['schools'] as const,
  list: (params: SchoolListParams) => ['schools', 'list', params] as const,
  active: ['schools', 'active'] as const,
  detail: (id: ID) => ['schools', 'detail', id] as const,
  resolve: (slug: string) => ['schools', 'resolve', slug] as const,
}

/** Admin list with search/status filters. Keeps showing the previous rows while a new search loads. */
export const useSchools = (params: SchoolListParams) =>
  useQuery({ queryKey: schoolKeys.list(params), queryFn: () => schoolRepository.list(params), placeholderData: keepPreviousData, staleTime: 0 })

/** Public dropdown source. Always refetched so a just-deactivated school disappears. */
export const useActiveSchools = () =>
  useQuery({ queryKey: schoolKeys.active, queryFn: () => schoolRepository.listActive(), staleTime: 0, refetchOnMount: 'always' })

export const useSchoolDetail = (id: ID) =>
  useQuery({ queryKey: schoolKeys.detail(id), queryFn: () => schoolRepository.getDetail(id), staleTime: 0, retry: false })

/** Resolves /school/:slug. Not cached across visits, so activation changes apply immediately. */
export const useResolveSchool = (slug: string) =>
  useQuery({ queryKey: schoolKeys.resolve(slug), queryFn: () => schoolRepository.resolveBySlug(slug), staleTime: 0, gcTime: 0 })

/** School data feeds the dashboard counts too, so every write refreshes both. */
function useInvalidateAfterWrite() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: schoolKeys.all }), qc.invalidateQueries({ queryKey: ['dashboard'] })])
}

export function useCreateSchool() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (input: SchoolInput) => schoolRepository.create(input), onSuccess: invalidate })
}

export function useUpdateSchool() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; input: SchoolInput }) => schoolRepository.update(v.id, v.input), onSuccess: invalidate })
}

export function useSetSchoolActive() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; isActive: boolean }) => schoolRepository.setActive(v.id, v.isActive), onSuccess: invalidate })
}

/**
 * A school's images with short-lived preview links (5 minutes). Kept in memory only, for a minute, and refreshed before
 * the links expire.
 */
export const useSchoolImages = (schoolId: ID) =>
  useQuery({ queryKey: ['schools', 'images', schoolId], queryFn: () => schoolRepository.listImages(schoolId), staleTime: 60_000, gcTime: 60_000, refetchInterval: 4 * 60_000, retry: false })

export function useSetPrimaryImage(schoolId: ID) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (imageId: ID) => schoolRepository.setPrimaryImage(imageId), onSuccess: () => qc.invalidateQueries({ queryKey: ['schools', 'images', schoolId] }) })
}

/** Approve / reject a school image (normally a public submission). */
export function useReviewImage(schoolId: ID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: ID; decision: SchoolImageStatus }) => schoolRepository.reviewImage(v.id, v.decision),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['schools', 'images', schoolId] }), qc.invalidateQueries({ queryKey: ['schools', 'pending-images'] })]),
  })
}

/** Schools with public image submissions waiting for review. */
export const usePendingImageCounts = () =>
  useQuery({ queryKey: ['schools', 'pending-images'], queryFn: () => schoolRepository.pendingImageCounts(), staleTime: 0, retry: false })

/** Public: submit one image for review (the batch runner calls this per file). Not kept in the mutation cache. */
export const submitSchoolImage = (input: SchoolImageSubmission, file: File) => schoolRepository.submitImage(input, file)
