import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Resets scroll on route change; honours #hash anchors. */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}
