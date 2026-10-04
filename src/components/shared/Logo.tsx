import { IdCard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BUSINESS } from '@/lib/business'
import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'dark' | 'light'
  className?: string
  showTagline?: boolean
}

export function Logo({ variant = 'dark', className, showTagline = true }: LogoProps) {
  const light = variant === 'light'
  return (
    <Link to="/" aria-label={`${BUSINESS.name} – home`} className={cn('flex items-center gap-2.5', className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-royal-600 to-navy-900 text-gold-400 shadow-md">
        <IdCard className="size-5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className={cn('font-display text-[15px] font-extrabold tracking-tight sm:text-base', light ? 'text-white' : 'text-navy-900')}>
          {BUSINESS.name}
        </span>
        {showTagline && (
          <span className={cn('hidden text-[11px] font-medium min-[380px]:block', light ? 'text-gold-400' : 'text-gold-700')}>
            {BUSINESS.tagline}
          </span>
        )}
      </span>
    </Link>
  )
}
