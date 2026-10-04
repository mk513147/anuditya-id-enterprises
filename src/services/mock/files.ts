import { delay } from '@/lib/delay'
import type { UploadedFile, UploadedFileType } from '@/types'
import { getExtension } from '@/validations/upload'
import type { FileRepository } from '../types'

/** In-memory only. Cleared on page refresh; nothing is stored permanently. */
const uploads: UploadedFile[] = []

/**
 * Prototype hook for testing the error state: upload any file whose name contains "FAIL"
 * (e.g. students-FAIL.xlsx). The mock fails part-way through, like a dropped connection.
 * A real repository would reject the same way on a storage/network error.
 */
export const MOCK_FAILURE_FILENAME_TOKEN = 'FAIL'

const pad = (n: number) => String(n).padStart(5, '0')

export const mockFileRepository: FileRepository = {
  async upload(file, { onProgress }) {
    const shouldFail = file.name.toUpperCase().includes(MOCK_FAILURE_FILENAME_TOKEN)

    // Simulated transfer: steady, slightly uneven progress over a couple of seconds.
    let percent = 0
    onProgress(0)
    while (percent < 100) {
      await delay(150)
      percent = Math.min(100, percent + 3 + Math.floor(Math.random() * 7))
      if (shouldFail && percent >= 55) throw new Error('Mock upload failure')
      onProgress(percent)
    }
    await delay(250) // "processing" after the last byte

    const now = new Date()
    const referenceNo = `FILE-${now.getFullYear()}-${pad(uploads.length + 1)}`
    const record: UploadedFile = {
      id: crypto.randomUUID(),
      referenceNo,
      originalName: file.name,
      storagePath: `uploads/${now.getFullYear()}/${referenceNo}/${file.name}`,
      type: getExtension(file.name) as UploadedFileType,
      sizeBytes: file.size,
      uploadedAt: now.toISOString(),
    }
    uploads.push(record) // the file's bytes are not kept in the prototype

    return {
      referenceNo: record.referenceNo,
      originalName: record.originalName,
      type: record.type,
      sizeBytes: record.sizeBytes,
      uploadedAt: record.uploadedAt,
    }
  },
}
