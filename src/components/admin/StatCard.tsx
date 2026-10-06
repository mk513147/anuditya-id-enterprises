import { createElement } from 'react'
import { Link } from 'react-router-dom'
import { SkeletonBlock } from '@/components/shared/QueryState'
import type { Tone } from '@/data/homeContent'
import { getIcon } from '@/lib/icons'
import { TONE_CHIP } from '@/lib/tones'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  value?: number
  hint?: string
  icon: string
  tone?: Tone
  /** Makes the whole card a link to the related admin page. */
  to?: string
  loading?: boolean
}

export function StatCard({ label, value, hint, icon, tone = 'blue', to, loading }: Props) {
  if (loading) return <SkeletonBlock className="h-28" />
  const body = (
    <>
      <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl', TONE_CHIP[tone])}>
        {createElement(getIcon(icon), { className: 'size-6', 'aria-hidden': true })}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-muted-ink">{label}</span>
        <span className="block font-display text-3xl font-extrabold leading-tight text-navy-900" data-testid={`stat-${label}`}>
          {value}
        </span>
        {hint && <span className="block text-xs text-muted-ink">{hint}</span>}
      </span>
    </>
  )
  const cls = 'flex items-center gap-4 rounded-[var(--radius-card)] border bg-white p-4 shadow-card transition-shadow sm:p-5'
  return to ? (
    <Link to={to} className={cn(cls, 'hover:shadow-card-hover')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
