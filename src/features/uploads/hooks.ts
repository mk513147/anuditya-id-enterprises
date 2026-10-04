import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { fileRepository } from '@/services'

/** Uploads one file and exposes live progress (0–100) reported by the repository. */
export function useUploadFile() {
  const [progress, setProgress] = useState(0)
  const mutation = useMutation({
    mutationFn: (file: File) => {
      setProgress(0)
      return fileRepository.upload(file, { onProgress: setProgress })
    },
  })
  return {
    upload: mutation.mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    progress,
    reset: () => {
      mutation.reset()
      setProgress(0)
    },
  }
}
