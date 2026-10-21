/**
 * Runs `task` for every item with at most `limit` in flight at once (photo downloads, image uploads), in input order of
 * starting. Stops starting new work once `signal` is aborted; tasks already running finish. Never rejects: each task
 * handles its own errors.
 */
export async function forEachLimit<T>(items: readonly T[], limit: number, task: (item: T, index: number) => Promise<void>, signal?: AbortSignal): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++
      await task(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
}
