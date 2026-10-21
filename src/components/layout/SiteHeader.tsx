import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { CallButton } from '@/components/shared/CallButton'
import { Logo } from '@/components/shared/Logo'
import { WhatsAppButton } from '@/components/shared/WhatsAppButton'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { BUSINESS } from '@/lib/business'
import { NAV_ITEMS } from '@/lib/navigation'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-white/90 backdrop-blur-md transition-shadow',
        scrolled ? 'border-border shadow-card' : 'border-transparent',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 xl:h-[72px]">
        <Logo variant="responsive" />

        {/*
          The row is capped at max-w-7xl (1216px of content) at every desktop width, so nothing here may grow at wider
          breakpoints: logo (~226px) + navigation (~710px) + contact controls (up to ~172px) must fit that one width.
          Labels never wrap, and the navigation does not shrink below its content.
        */}
        <nav aria-label="Main" className="hidden shrink-0 xl:block">
          <ul className="flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'relative whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-muted-ink transition-colors hover:bg-royal-50 hover:text-navy-900',
                      isActive && 'text-royal-600 after:absolute after:inset-x-3 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-gold-500',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          <WhatsAppButton size="sm" className="h-10" iconOnly label="WhatsApp" />
          <CallButton size="sm" className="h-10" iconOnly label="Call" />
          <span className="hidden whitespace-nowrap text-sm font-semibold text-navy-900 2xl:inline">{BUSINESS.phone}</span>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="xl:hidden" aria-label="Open menu">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" showCloseButton={false} className="flex w-[88%] max-w-sm flex-col gap-0 p-0">
            <SheetHeader className="flex-row items-center justify-between border-b p-4">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation and contact actions</SheetDescription>
              <Logo variant="compact" className="h-8" />
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close menu">
                  <X className="size-6" />
                </Button>
              </SheetClose>
            </SheetHeader>

            <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-12 items-center rounded-xl px-4 text-base font-medium text-ink transition-colors hover:bg-royal-50',
                          isActive && 'bg-royal-50 text-royal-600',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-2 border-t bg-surface p-4">
              <p className="text-xs font-medium text-muted-ink">{BUSINESS.tagline}</p>
              <WhatsAppButton size="lg" className="w-full" label="Chat on WhatsApp" />
              <CallButton size="lg" className="w-full" label={`Call ${BUSINESS.phone}`} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
