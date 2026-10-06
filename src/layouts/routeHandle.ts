import { useMatches } from 'react-router-dom'

/** Attach to a route's `handle` to give it a title for the admin top bar. */
export interface RouteHandle {
  title: string
}

export function useRouteTitle(fallback = 'Admin'): string {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i].handle as Partial<RouteHandle> | undefined
    if (handle?.title) return handle.title
  }
  return fallback
}
