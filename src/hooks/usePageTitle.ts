import { useEffect } from 'react'
import { BUSINESS } from '@/lib/business'

/** Sets the browser tab title for the current page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = `${title} | ${BUSINESS.name}`
    return () => {
      document.title = previous
    }
  }, [title])
}
