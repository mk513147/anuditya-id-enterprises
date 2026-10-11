import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { fileRepository } from '@/services'
import type { SchoolFileSubmission } from '@/types'

/**
 * Submits one school data file and exposes progress (0–100) reported by the repository. Resolves only once the file is
 * stored AND registered. Not kept in the mutation cache (it holds contact details).
 */
export function useSubmitSchoolFile() {
  const qc = useQueryClient()
  const [progress, setProgress] = useState(0)
  const mutation = useMutation({
    mutationFn: (input: SchoolFileSubmission) => {
      setProgress(0)
      return fileRepository.submit(input, { onProgress: setProgress })
    },
    gcTime: 0,
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['files'] }), qc.invalidateQueries({ queryKey: ['dashboard'] })]),
  })
  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    progress,
    reset: () => {
      mutation.reset()
      setProgress(0)
    },
  }
}
