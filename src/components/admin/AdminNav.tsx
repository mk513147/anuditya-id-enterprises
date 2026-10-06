import { ExternalLink } from 'lucide-react'
import { createElement } from 'react'
import { NavLink } from 'react-router-dom'
import { ADMIN_NAV } from '@/lib/navigation'
import { getIcon } from '@/lib/icons'
import { cn } from '@/lib/utils'

/** Sidebar navigation. Used in the fixed desktop sidebar and inside the mobile drawer. */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {ADMIN_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/admin'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                  isActive ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/8 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span aria-hidden className="absolute -left-3 top-2 h-7 w-1 rounded-r-full bg-gold-500" />}
                  {createElement(getIcon(item.icon), { className: cn('size-5 shrink-0', isActive && 'text-gold-400'), 'aria-hidden': true })}
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <NavLink
          to="/"
          onClick={onNavigate}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/8 hover:text-white"
        >
          <ExternalLink className="size-5 shrink-0" aria-hidden />
          View public website
        </NavLink>
      </div>
    </nav>
  )
}
