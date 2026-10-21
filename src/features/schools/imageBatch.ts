import { forEachLimit } from '@/lib/concurrency'
import { describeError, isRepositoryError } from '@/services/errors'
import { checkImageFile, SCHOOL_IMAGE_MAX_BATCH } from '@/validations/schoolImage'

/**
 * Bulk school-image upload queue, shared by the administrator uploader and the public "Submit School Images" form. Each file has its own outcome; a batch is never reported as a whole success when some
 * files failed. Retrying sends only the files that failed (never one that already uploaded).
 */
export type QueueStatus = 'ready' | 'uploading' | 'done' | 'failed' | 'invalid' | 'duplicate'

export interface QueueItem {
  key: string
  file: File
  status: QueueStatus
  message?: string
}

export const UPLOAD_CONCURRENCY = 3
const ALREADY_PRESENT = 'Already present for this school.'

/** Same file chosen twice (picker or drop) = same key, so it is only queued once. */
export const fileKey = (f: File) => `${f.name}\u0000${f.size}\u0000${f.lastModified}`

/** Adds files to the queue: duplicates are skipped, invalid files are kept (to show why) but never uploaded. */
export function addToQueue(queue: QueueItem[], files: File[], max = SCHOOL_IMAGE_MAX_BATCH): { queue: QueueItem[]; skippedDuplicates: number; overLimit: number } {
  const seen = new Set(queue.map((q) => q.key))
  let skippedDuplicates = 0
  let overLimit = 0
  const next = [...queue]
  for (const file of files) {
    const key = fileKey(file)
    if (seen.has(key)) {
      skippedDuplicates++
      continue
    }
    if (next.filter((q) => q.status !== 'invalid').length >= max) {
      overLimit++
      continue
    }
    seen.add(key)
    const problem = checkImageFile(file)
    next.push({ key, file, status: problem ? 'invalid' : 'ready', message: problem ?? undefined })
  }
  return { queue: next, skippedDuplicates, overLimit }
}

/** Uploads every 'ready' and 'failed' item (bounded concurrency), reporting each status change through `onUpdate`. */
export async function runBatch(
  items: QueueItem[],
  upload: (file: File) => Promise<unknown>,
  { onUpdate, signal, concurrency = UPLOAD_CONCURRENCY }: { onUpdate: (key: string, patch: Partial<QueueItem>) => void; signal?: AbortSignal; concurrency?: number },
): Promise<{ done: number; failed: number; duplicate: number; invalid: number }> {
  const todo = items.filter((i) => i.status === 'ready' || i.status === 'failed')
  const tally = { done: 0, failed: 0, duplicate: 0, invalid: 0 }
  await forEachLimit(todo, concurrency, async (item) => {
    onUpdate(item.key, { status: 'uploading', message: undefined })
    try {
      // The public submission resolves 'already_present' (nothing stored) when the school already has this exact image.
      if ((await upload(item.file)) === 'already_present') {
        tally.duplicate++
        onUpdate(item.key, { status: 'duplicate', message: ALREADY_PRESENT })
        return
      }
      tally.done++
      onUpdate(item.key, { status: 'done', message: undefined })
    } catch (e) {
      if (isRepositoryError(e, 'duplicate_image')) {
        tally.duplicate++
        onUpdate(item.key, { status: 'duplicate', message: ALREADY_PRESENT })
      } else if (isRepositoryError(e, 'invalid_input')) {
        tally.invalid++
        onUpdate(item.key, { status: 'invalid', message: e.message })
      } else {
        tally.failed++
        onUpdate(item.key, { status: 'failed', message: describeError(e, 'Upload failed. You can retry.') })
      }
    }
  }, signal)
  return tally
}
