import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from './Reveal'

interface Props {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  tone?: 'dark' | 'light'
  action?: ReactNode
  id?: string
}

export function SectionHeading({ eyebrow, title, description, align = 'center', tone = 'dark', action, id }: Props) {
  const light = tone === 'light'
  return (
    <Reveal className={cn('mb-8 sm:mb-12', align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl')}>
      {eyebrow && (
        <p className={cn('mb-2 text-xs font-bold uppercase tracking-[0.14em]', light ? 'text-gold-400' : 'text-royal-600')}>
          {eyebrow}
        </p>
      )}
      <h2 id={id} className={cn('text-balance text-2xl font-extrabold sm:text-4xl', light && 'text-white')}>
        {title}
      </h2>
      {description && (
        <p className={cn('mt-3 text-pretty text-base leading-relaxed sm:text-lg', light ? 'text-white/75' : 'text-muted-ink')}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Reveal>
  )
}
