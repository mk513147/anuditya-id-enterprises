import { useMutation } from '@tanstack/react-query'
import { studentRepository } from '@/services'
import type { StudentSubmission } from '@/types'

export const useSubmitStudent = () =>
  useMutation({ mutationFn: (input: StudentSubmission) => studentRepository.submit(input) })
