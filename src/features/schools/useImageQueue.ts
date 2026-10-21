import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SCHOOL_IMAGE_MAX_BATCH } from '@/validations/schoolImage'
import { addToQueue, type QueueItem, type QueueStatus } from './imageBatch'

export type QueueRow = QueueItem & { previewUrl?: string }
const revoke = (rows: QueueRow[]) => rows.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl))

/** Queue state. Local previews (object URLs) are created when a file is added and revoked when it leaves the list or the page closes. */
export function useImageQueue({ locked }: { locked: boolean }) {
  const [queue, setQueue] = useState<QueueRow[]>([])
  const latest = useRef<QueueRow[]>([])
  useEffect(() => {
    latest.current = queue
  }, [queue])
  useEffect(() => () => revoke(latest.current), [])

  const add = (files: File[]) => {
    if (locked) return
    const r = addToQueue(queue, files)
    const known = new Set(queue.map((q) => q.key))
    setQueue(r.queue.map((i) => (known.has(i.key) ? (queue.find((q) => q.key === i.key) as QueueRow) : { ...i, previewUrl: i.status === 'invalid' ? undefined : URL.createObjectURL(i.file) })))
    if (r.overLimit) toast.warning(`Up to ${SCHOOL_IMAGE_MAX_BATCH} images per batch`, { description: `${r.overLimit} image${r.overLimit === 1 ? ' was' : 's were'} not added. Send this batch first, then add the rest.` })
    if (r.skippedDuplicates) toast.info(`${r.skippedDuplicates} file${r.skippedDuplicates === 1 ? ' was' : 's were'} already in the list`)
  }
  const remove = (key: string) => {
    revoke(queue.filter((i) => i.key === key))
    setQueue(queue.filter((i) => i.key !== key))
  }
  const update = (key: string, patch: Partial<QueueItem>) => setQueue((q) => q.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const clearFinished = () => {
    revoke(queue.filter((i) => i.status !== 'ready' && i.status !== 'failed'))
    setQueue(queue.filter((i) => i.status === 'ready' || i.status === 'failed'))
  }
  const clearAll = () => {
    revoke(queue)
    setQueue([])
  }
  const count = (s: QueueStatus) => queue.filter((i) => i.status === s).length
  return { queue, add, remove, update, clearFinished, clearAll, count }
}
