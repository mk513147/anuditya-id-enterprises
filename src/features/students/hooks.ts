import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { studentRepository } from '@/services'
import type { StudentListParams } from '@/services/types'
import type { ID, Student, StudentEditInput, StudentSubmission } from '@/types'

export const studentKeys = {
  all: ['students'] as const,
  list: (params: StudentListParams) => ['students', 'list', params] as const,
  detail: (id: ID) => ['students', 'detail', id] as const,
  options: ['students', 'options'] as const,
}

/** Students feed school counts and the dashboard too, so every write refreshes all three. */
function useInvalidateAfterWrite() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: studentKeys.all }),
      qc.invalidateQueries({ queryKey: ['schools'] }),
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
}

/** Public submission (/student-form and /school/:slug). */
export function useSubmitStudent() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (input: StudentSubmission) => studentRepository.submit(input), onSuccess: invalidate })
}

/** Admin list. Keeps showing the previous rows while a new search/filter/page loads. */
export const useAdminStudents = (params: StudentListParams) =>
  useQuery({ queryKey: studentKeys.list(params), queryFn: () => studentRepository.list(params), placeholderData: keepPreviousData, staleTime: 0 })

export const useStudentDetail = (id: ID) =>
  useQuery({ queryKey: studentKeys.detail(id), queryFn: () => studentRepository.getDetail(id), staleTime: 0, retry: false })

export const useStudentFilterOptions = () =>
  useQuery({ queryKey: studentKeys.options, queryFn: () => studentRepository.getFilterOptions(), staleTime: 0 })

export function useUpdateStudent() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; input: StudentEditInput }) => studentRepository.update(v.id, v.input), onSuccess: invalidate })
}

export function useSetStudentArchived() {
  const invalidate = useInvalidateAfterWrite()
  return useMutation({ mutationFn: (v: { id: ID; archived: boolean }) => studentRepository.setArchived(v.id, v.archived), onSuccess: invalidate })
}

/** Restores an archived student (non-destructive, so no confirmation) and reports the outcome. */
export function useRestoreStudent() {
  const restore = useSetStudentArchived()
  return async (student: Student) => {
    try {
      await restore.mutateAsync({ id: student.id, archived: false })
      toast.success('Student restored', { description: `${student.name} is active again.` })
    } catch {
      toast.error('Could not restore the student. Please try again.')
    }
  }
}
