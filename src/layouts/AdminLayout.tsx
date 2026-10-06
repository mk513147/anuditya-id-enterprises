import { LogOut, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminNav } from '@/components/admin/AdminNav'
import { Logo } from '@/components/shared/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BUSINESS } from '@/lib/business'
import { useRouteTitle } from './routeHandle'

function AdminBrand() {
  return (
    <div className="flex flex-col gap-1">
      <Logo variant="light" showTagline={false} />
      <p className="pl-[3.125rem] text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-400">Admin Panel</p>
    </div>
  )
}

export function AdminLayout() {
  const title = useRouteTitle('Admin')
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  // The admin area is not for search engines.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])

  const logout = () => {
    // Prototype: there is no session to end yet. Real sign-out arrives with authentication.
    toast.info('Signed out (demo). Real authentication is not built yet.')
    navigate('/login')
  }

  return (
    <div className="min-h-svh bg-surface lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#admin-main" className="sr-only z-50 rounded-md bg-navy-900 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-svh flex-col bg-navy-950 text-white lg:flex">
        <div className="border-b border-white/10 px-4 py-5">
          <AdminBrand />
        </div>
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-white/90 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open admin menu">
                <Menu className="size-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" showCloseButton={false} className="flex w-[85%] max-w-72 flex-col gap-0 border-none bg-navy-950 p-0 text-white">
              <SheetHeader className="flex-row items-center justify-between border-b border-white/10 p-4">
                <SheetTitle className="sr-only">Admin menu</SheetTitle>
                <SheetDescription className="sr-only">Admin navigation</SheetDescription>
                <AdminBrand />
                <SheetClose asChild>
                  <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white" aria-label="Close admin menu">
                    <X className="size-6" />
                  </Button>
                </SheetClose>
              </SheetHeader>
              <AdminNav onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-navy-900 sm:text-xl">{title}</h1>

          <div className="flex items-center gap-2">
            {/* Placeholder until real authentication exists */}
            <div className="flex items-center gap-2 rounded-full bg-royal-50 py-1 pl-1 pr-1 sm:pr-3" title="Administrator (placeholder)">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-royal-600 text-xs font-bold text-white">AD</span>
              <span className="hidden text-sm font-semibold text-navy-900 sm:block">Administrator</span>
            </div>
            <Button variant="outline" size="sm" className="h-11 sm:px-4" onClick={logout} aria-label="Log out">
              <LogOut aria-hidden />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6 lg:p-8">
          <Outlet />
          <p className="mt-10 text-center text-xs text-muted-ink">{BUSINESS.name} · Admin prototype · data shown is demo data held in memory</p>
        </main>
      </div>
    </div>
  )
}
