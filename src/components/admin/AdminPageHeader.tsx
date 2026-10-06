import type { ReactNode } from 'react'

/** Description + primary actions row under the top bar (the top bar already carries the page title). */
export function AdminPageHeader({ description, actions }: { description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {description && <div className="max-w-2xl text-sm text-muted-ink sm:text-base">{description}</div>}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function AdminCard({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[var(--radius-card)] border bg-white shadow-card ${className ?? ''}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
          {title && <h2 className="text-base font-bold sm:text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
