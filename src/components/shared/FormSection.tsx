import { createElement, type ReactNode } from 'react'
import { getIcon } from '@/lib/icons'

interface Props {
  step: number
  icon: string
  title: string
  children: ReactNode
}

/** A titled group of related fields inside a card. */
export function FormSection({ step, icon, title, children }: Props) {
  const headingId = `form-section-${step}`
  return (
    <section aria-labelledby={headingId} className="rounded-[var(--radius-card)] border bg-white p-4 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-3 border-b pb-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-royal-50 text-royal-600">
          {createElement(getIcon(icon), { className: 'size-5', 'aria-hidden': true })}
        </span>
        <h2 id={headingId} className="text-lg font-bold">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}
