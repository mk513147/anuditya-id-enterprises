import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DataTable } from '@/components/admin/DataTable'
import { RepositoryError } from '@/services/errors'
import type { AdminOrder } from '@/services/types'
import { ORDER_STATUSES } from '@/types'
import { OrderHistory } from './OrderHistory'
import { OrderDetailView } from './OrderDetailView'
import { OrderFilters } from './OrderFilters'
import { OrderStatusUpdater } from './OrderStatusUpdater'
import { adminOrderColumns, orderRowActions } from './orderColumns'
import { orderStatGroups } from './orderStats'
import { changeWarning, describeStatusChange, statusErrorMessage } from './statusChange'
import { toOrderListParams } from './useOrderFilters'

const count = (html: string, needle: string) => html.split(needle).length - 1
const order = (over: Partial<AdminOrder> = {}): AdminOrder => ({
  id: 'ord-3', orderNo: 'JOB-2026-0003', schoolId: 'sch-sunrise', schoolName: 'Sunrise Public School', schoolCode: 'SUN-001', customer: 'Sunrise Public School',
  service: 'School Diary', quantity: 600, status: 'Printing', orderDate: '2026-09-05', expectedDelivery: '2026-10-12', ...over,
})
const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('admin order table', () => {
  const rows = [order(), order({ id: 'ord-9', orderNo: 'JOB-2026-0009', status: 'Dispatched', schoolName: "St. Mary's School" })]
  const html = inRouter(<DataTable caption="Orders" columns={adminOrderColumns} rows={rows} rowKey={(o) => o.id} actions={orderRowActions} />)

  it('renders each order with reference, school, quantity, status and dates', () => {
    for (const text of ['JOB-2026-0003', 'JOB-2026-0009', 'Sunrise Public School', 'School Diary', '600', 'Printing', 'Dispatched', '5 Sept 2026', '12 Oct 2026']) {
      expect(html, text).toContain(text)
    }
  })

  it('links every order to its own detail route, in both the table and the phone cards', () => {
    expect(count(html, 'href="/admin/orders/ord-3"')).toBe(4) // reference link + action, in table and card layouts
    expect(count(html, 'href="/admin/orders/ord-9"')).toBe(4)
    expect(html).toContain('aria-label="View order JOB-2026-0003"')
  })

  it('has an accessible caption, column headers and both a table and a phone list', () => {
    expect(html).toContain('<caption class="sr-only">Orders</caption>')
    expect(count(html, '<th ')).toBe(adminOrderColumns.length + 1)
    expect(html).toContain('<ul aria-label="Orders"')
  })

  it('status is always text, never colour alone', () => {
    expect(html).toMatch(/Printing<\/span>/)
  })
})

describe('order filters', () => {
  const base = { filters: { q: '', status: 'all' as const, from: '', to: '', page: 1 }, update: () => {}, clear: () => {}, hasActiveFilters: false }

  it('offers search, a status filter with every status, and a date range, all labelled', () => {
    const html = renderToStaticMarkup(<OrderFilters {...base} />)
    for (const l of ['Search', 'Status', 'Ordered from', 'Ordered to']) expect(html, l).toContain(`>${l}</label>`)
    expect(html).toContain('All statuses')
    for (const s of ORDER_STATUSES) expect(html, s).toContain(`<option value="${s}"`)
    expect(html).not.toContain('Active filters')
  })

  it('shows removable chips and a "Clear all filters" action when filters are active', () => {
    const html = renderToStaticMarkup(
      <OrderFilters {...base} hasActiveFilters filters={{ q: 'lotus', status: 'Designing', from: '2026-09-01', to: '', page: 1 }} />,
    )
    expect(html).toContain('Search: “lotus”')
    expect(html).toContain('Status: Designing')
    expect(html).toContain('From: 1 Sept 2026')
    expect(html).toContain('Clear all filters')
    expect(count(html, 'aria-label="Remove filter')).toBe(3)
  })

  it('turns URL filters into repository params, omitting empty ones', () => {
    expect(toOrderListParams({ q: '', status: 'all', from: '', to: '', page: 1 }, 10)).toEqual({ search: undefined, status: 'all', from: undefined, to: undefined, page: 1, pageSize: 10 })
    expect(toOrderListParams({ q: 'x', status: 'Ready', from: '2026-01-01', to: '2026-02-01', page: 3 }, 5)).toEqual({ search: 'x', status: 'Ready', from: '2026-01-01', to: '2026-02-01', page: 3, pageSize: 5 })
  })
})

describe('order stats', () => {
  it('groups the overall status counts', () => {
    const byStatus = { 'Order Received': 1, 'Data Verification': 2, Designing: 3, Printing: 4, 'Quality Check': 5, Ready: 6, Dispatched: 7, Delivered: 8 }
    expect(orderStatGroups({ total: 36, byStatus })).toEqual({ total: 36, awaitingStart: 3, inProduction: 12, readyOrDispatched: 13, delivered: 8 })
  })
})

describe('order detail view', () => {
  it('shows reference, school, service, quantity, dates, status, timeline and history', () => {
    const html = inRouter(<OrderDetailView order={order({ notes: 'Internal: courier AWB pending' })} />)
    for (const text of ['JOB-2026-0003', 'Sunrise Public School', 'SUN-001', 'School Diary', '600', '5 Sept 2026', '12 Oct 2026', 'Printing', 'Your order is being printed.', 'Order placed']) {
      expect(html, text).toContain(text)
    }
    expect(html).toMatch(/<ol[^>]*aria-label="Order progress"/)
    expect(count(html, 'data-state="completed"')).toBe(3)
    expect(count(html, 'data-state="current"')).toBe(1)
    expect(html).toContain('href="/admin/schools/sch-sunrise"')
    expect(html).toContain('href="/job-status?ref=JOB-2026-0003"')
  })

  it('labels internal notes as internal and does not imply a student link', () => {
    const html = inRouter(<OrderDetailView order={order({ notes: 'Internal: courier AWB pending' })} />)
    expect(html).toContain('Internal note (never shown publicly)')
    expect(html).toContain('Orders are placed for a school, not for individual students.')
    expect(html).not.toMatch(/Student name|Roll|Admission/)
  })

  it('omits the note and "last changed" rows when the order has neither', () => {
    const html = inRouter(<OrderDetailView order={order()} />)
    expect(html).not.toContain('Internal note')
    expect(html).not.toContain('Status last changed')
  })

  it('renders the timeline correctly for every supported status', () => {
    for (const status of ORDER_STATUSES) {
      const html = inRouter(<OrderDetailView order={order({ status })} />)
      const at = ORDER_STATUSES.indexOf(status)
      expect(count(html, 'data-state="completed"'), status).toBe(status === 'Delivered' ? 7 : at)
      expect(count(html, 'data-state="current"'), status).toBe(status === 'Delivered' ? 0 : 1)
      expect(html).toContain(`data-testid="order-status"`)
    }
  })

  it('renders the updater slot only when one is given', () => {
    expect(inRouter(<OrderDetailView order={order()} />)).not.toContain('Update status')
    expect(inRouter(<OrderDetailView order={order()} updater={<p>slot</p>} />)).toContain('Update status')
  })
})

describe('order history', () => {
  it('starts with "order placed" and says plainly when nothing has been recorded', () => {
    const html = renderToStaticMarkup(<OrderHistory order={{ orderDate: '2026-09-05' }} />)
    expect(html).toContain('Order placed')
    expect(html).toContain('No status changes have been recorded yet')
    expect(count(html, 'data-testid="history-entry"')).toBe(0)
  })

  it('lists recorded changes in order with their timestamps', () => {
    const html = renderToStaticMarkup(
      <OrderHistory order={{ orderDate: '2026-09-05', statusHistory: [{ status: 'Quality Check', at: '2026-10-05T09:00:00.000Z' }, { status: 'Ready', at: '2026-10-06T09:00:00.000Z' }] }} />,
    )
    expect(count(html, 'data-testid="history-entry"')).toBe(2)
    expect(html.indexOf('Quality Check')).toBeLessThan(html.indexOf('Ready'))
    expect(html).toContain('dateTime="2026-10-05T09:00:00.000Z"')
    expect(html).not.toContain('No status changes')
  })
})

describe('status update control', () => {
  const client = new QueryClient()
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <OrderStatusUpdater order={order()} />
    </QueryClientProvider>,
  )

  it('offers exactly the supported statuses, marks the current one, and starts on it', () => {
    expect(count(html, '<option ')).toBe(ORDER_STATUSES.length)
    for (const s of ORDER_STATUSES) expect(html, s).toContain(`value="${s}"`)
    expect(html).toContain('Printing (current)')
    expect(html).toMatch(/<option value="Printing"[^>]*selected|<select[^>]*value="Printing"/)
  })

  it('cannot be submitted until a different status is chosen, and says a confirmation follows', () => {
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Update status<\/button>/)
    expect(html).toContain('You will be asked to confirm')
  })

  it('does not show an error or an open dialog initially', () => {
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('role="dialog"')
  })
})

describe('confirmation wording and error feedback', () => {
  it('describes direction and distance of a change', () => {
    expect(describeStatusChange('Designing', 'Printing')).toEqual({ direction: 'forward', steps: 1 })
    expect(describeStatusChange('Ready', 'Designing')).toEqual({ direction: 'backward', steps: 3 })
    expect(describeStatusChange('Ready', 'Ready')).toEqual({ direction: 'none', steps: 0 })
    expect(describeStatusChange('Order Received', 'Delivered').steps).toBe(7)
  })

  it('warns about skipped stages and backward moves, but not about a plain next step', () => {
    expect(changeWarning(describeStatusChange('Designing', 'Printing'))).toBeNull()
    expect(changeWarning(describeStatusChange('Designing', 'Ready'))).toBe('This skips 2 stages.')
    expect(changeWarning(describeStatusChange('Designing', 'Quality Check'))).toBe('This skips 1 stage.')
    expect(changeWarning(describeStatusChange('Ready', 'Printing'))).toMatch(/back to an earlier stage/)
    expect(changeWarning(describeStatusChange('Ready', 'Ready'))).toBeNull()
  })

  it('turns every repository failure into a clear, specific message', () => {
    expect(statusErrorMessage(new RepositoryError('not_found', 'x'))).toMatch(/no longer exists/)
    expect(statusErrorMessage(new RepositoryError('invalid_status', 'x'))).toMatch(/not supported/)
    expect(statusErrorMessage(new RepositoryError('no_change', 'x'))).toMatch(/already in that status/)
    expect(statusErrorMessage(new RepositoryError('invalid_id', 'x'))).toMatch(/could not be identified/)
    expect(statusErrorMessage(new Error('network down'))).toMatch(/Nothing was changed/)
    expect(statusErrorMessage('weird')).toMatch(/Nothing was changed/)
  })
})
