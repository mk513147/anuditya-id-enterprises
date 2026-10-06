import { Outlet, useLocation } from 'react-router-dom'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { PageTransition } from '@/components/shared/PageTransition'
import { ScrollToTop } from '@/components/shared/ScrollToTop'

export function PublicLayout() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-navy-900 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <ScrollToTop />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <PageTransition key={pathname}>
          <Outlet />
        </PageTransition>
      </main>
      <SiteFooter />
    </div>
  )
}
