import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  /** Extra classes for the desktop cell, e.g. text alignment. */
  className?: string
}

interface Props<T> {
  /** Accessible name for the table. */
  caption: string
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  /** Row actions. `context` lets callers show icon-only buttons in the table and labelled ones on cards. */
  actions?: (row: T, context: 'table' | 'card') => ReactNode
  /** Dims the table while a background refetch is running. */
  busy?: boolean
}

/**
 * One data definition, two layouts: a real <table> from `md`, and stacked cards below it
 * (the first column becomes the card title) so nothing needs horizontal scrolling on phones.
 */
export function DataTable<T>({ caption, columns, rows, rowKey, actions, busy }: Props<T>) {
  const [first, ...rest] = columns
  return (
    <div className={cn('transition-opacity', busy && 'opacity-60')} aria-busy={busy}>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b bg-surface text-xs font-bold uppercase tracking-wide text-muted-ink">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 font-bold', c.className)}>
                  {c.header}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="transition-colors hover:bg-royal-50/50">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>
                    {c.cell(row)}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right align-middle">{actions(row, 'table')}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone */}
      <ul aria-label={caption} className="divide-y md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="space-y-3 p-4">
            <div className="font-semibold text-navy-900">{first.cell(row)}</div>
            <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {rest.map((c) => (
                <div key={c.key} className="contents">
                  <dt className="text-muted-ink">{c.header}</dt>
                  <dd className="min-w-0 break-words font-medium text-ink">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div>{actions(row, 'card')}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
