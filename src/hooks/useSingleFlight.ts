import { useCallback, useRef } from 'react'

/**
 * Runs `task` unless a previous run is still going; extra calls are ignored. React state updates are
 * asynchronous, so several rapid clicks can all pass a `disabled`/`isPending` check; this guard is synchronous.
 */
export function useSingleFlight() {
  const running = useRef(false)
  return useCallback(async (task: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    try {
      await task()
    } finally {
      running.current = false
    }
  }, [])
}
